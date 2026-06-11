import type {
  ServiceDefinition,
  ServicePlanResource,
  ValidationRule,
  SecurityScanRule,
  CostProfile,
  AIHints,
} from '../types';
import type { LambdaConfig } from './types';
import { createDefaultLambdaConfig, getLambdaDisplayName } from './defaults';
import { validateLambdaConfig } from './validate';
import { LambdaNode } from './lambda-node';
import { LambdaInspector } from './lambda-inspector';
import { LambdaIcon } from '@/components/icons';

export const lambdaService: ServiceDefinition<LambdaConfig> = {
  /* Identity. */
  id: 'lambda',
  cloudFormationType: 'AWS::Lambda::Function',
  name: 'AWS Lambda',
  shortName: 'Lambda',
  category: 'compute',
  description:
    'Serverless compute — run code with no servers to manage. Configure runtime, memory, timeout, handler, and environment variables.',
  icon: LambdaIcon,
  accentColor: '#FF9900',
  capabilities: {
    provides: ['compute'],
    requires: ['execution-role'],
    optional: [
      'compute-artifact',
      'network-attachment',
      'file-system',
      'event-source',
      'lambda-layer',
    ],
  },
  allowedParents: ['subnet', 'app-group', 'vpc'],
  forbiddenParents: ['s3', 'iam-role', 'security-group', 'ecr'],
  allowedRelationships: [
    'eventbridge',
    'api-gateway',
    'sqs',
    'sns',
    'iam-role',
    'dynamodb',
    'efs',
    'ecr',
    'cloudwatch',
    'lambda-layer',
    'appsync',
    'ssm',
    'ses',
    'msk',
    'opensearch',
    'bedrock',
  ],
  forbiddenRelationships: [
    'lambda',
    'vpc',
    'subnet',
    'security-group',
    'route-table',
    'nat-gateway',
    'internet-gateway',
  ],

  /* Config. */
  createDefaultConfig: createDefaultLambdaConfig,
  validate: validateLambdaConfig,
  getDisplayName: getLambdaDisplayName,

  /* UI. */
  NodeComponent: LambdaNode,
  InspectorComponent: LambdaInspector,

  /* Declarative validation rules (graph-level, run by the validation engine). */
  validationRules: [
    {
      id: 'lambda-requires-iam-role',
      message: 'AWS Lambda requires an IAM Role connected on the canvas.',
      check: ({ node, nodes, edges }) => {
        return !edges.some((edge) => {
          const otherId = edge.source === node.id ? edge.target : edge.source;
          return (
            nodes.find((n) => n.id === otherId)?.data.serviceId === 'iam-role'
          );
        });
      },
    },
    {
      id: 'lambda-efs-requires-network',
      message:
        'EFS requires Lambda to be placed in a Subnet and connected to a Security Group (VPC execution).',
      check: ({ node, nodes, edges }) => {
        const hasEfs = edges.some((edge) => {
          const otherId = edge.source === node.id ? edge.target : edge.source;
          return nodes.find((n) => n.id === otherId)?.data.serviceId === 'efs';
        });
        if (!hasEfs) return false;

        const isInsideSubnet = (() => {
          let current = nodes.find((n) => n.id === node.parentNode);
          while (current) {
            if (current.data.serviceId === 'subnet') return true;
            current = nodes.find((n) => n.id === current!.parentNode);
          }
          return false;
        })();

        const hasSubnetEdge = edges.some((edge) => {
          const otherId = edge.source === node.id ? edge.target : edge.source;
          return (
            nodes.find((n) => n.id === otherId)?.data.serviceId === 'subnet'
          );
        });
        const hasSg = edges.some((edge) => {
          const otherId = edge.source === node.id ? edge.target : edge.source;
          return (
            nodes.find((n) => n.id === otherId)?.data.serviceId ===
            'security-group'
          );
        });

        return !(isInsideSubnet || hasSubnetEdge) || !hasSg;
      },
    },
    {
      id: 'lambda-container-requires-ecr',
      message:
        'Container Lambda requires an ECR Repository connection or Image URI.',
      check: ({ node, nodes, edges }) => {
        if (node.data.config.packageType !== 'Image') return false;
        const hasImageUri = Boolean(node.data.config.imageUri);
        const hasEcr = edges.some((edge) => {
          const otherId = edge.source === node.id ? edge.target : edge.source;
          return nodes.find((n) => n.id === otherId)?.data.serviceId === 'ecr';
        });
        return !hasImageUri && !hasEcr;
      },
    },
  ] satisfies ValidationRule[],

  /* Security scan rules. */
  securityRules: [
    {
      id: 'lambda-public-function-url',
      severity: 'high',
      title: 'Public Unauthenticated Function URL',
      description: (name) =>
        `Lambda function "${name}" has a public unauthenticated HTTPS endpoint enabled. This allows anyone on the internet to invoke your function.`,
      check: (config) =>
        Boolean(config.enableFunctionUrl) &&
        config.functionUrlAuthType === 'NONE',
    },
    {
      id: 'lambda-public-subnet',
      severity: 'medium',
      title: 'Lambda Hosted in Public Subnet',
      description: (name) =>
        `Lambda function "${name}" is connected to a public subnet. Serverless resources should reside in private subnets for network isolation.`,
      check: (_config, node, edges, nodes) => {
        return edges
          .filter((e) => e.source === node.id || e.target === node.id)
          .some((edge) => {
            const otherId = edge.source === node.id ? edge.target : edge.source;
            const other = nodes.find((n) => n.id === otherId);
            return (
              other?.data.serviceId === 'subnet' &&
              other.data.config?.subnetType === 'public'
            );
          });
      },
    },
  ] satisfies SecurityScanRule[],

  /* Cost profile. */
  costProfile: {
    tier: 'variable',
    estimate: (config) => {
      const memory = (config.memorySize as number) || 256;
      const timeout = (config.timeout as number) || 15;
      const provisioned = (config.provisionedConcurrency as number) || 0;
      const BASELINE_REQUESTS = 1_000_000;
      const BASELINE_DURATION = 0.5;
      const gbSeconds = (memory / 1024) * BASELINE_DURATION * BASELINE_REQUESTS;
      const computeCost = gbSeconds * 0.0000166667;
      const requestCost = (BASELINE_REQUESTS / 1_000_000) * 0.2;
      let total = computeCost + requestCost;
      if (provisioned > 0) {
        const pcHours = 24 * 30.5;
        total +=
          provisioned * (memory / 1024) * pcHours * 3600 * 0.0000097222 +
          provisioned * pcHours * 3600 * 0.0000041667;
      }
      // Worst case contribution (using timeout instead of baseline duration)
      void timeout;
      return Math.round(total * 100) / 100;
    },
  } satisfies CostProfile,

  /* AI hints. */
  aiHints: {
    summary:
      'Serverless compute function that executes code on demand without managing servers.',
    role: 'Executes business logic in response to events, API calls, or scheduled triggers.',
    useCases: [
      'API request handlers',
      'Event-driven data processors',
      'Scheduled background jobs',
      'Stream processors',
      'Microservice functions',
    ],
    keyAttributes: [
      'functionName',
      'runtime',
      'memorySize',
      'timeout',
      'handler',
    ],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true },

  /* Plan. */
  buildPlanResource: (
    nodeId: string,
    config: LambdaConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    const envCount = config.environmentVariables.filter(
      (e) => e.key.trim() || e.value.trim(),
    ).length;

    return {
      id: nodeId,
      cloudFormationType: 'AWS::Lambda::Function',
      name: getLambdaDisplayName(config),
      connectionCount,
      details: [
        { label: 'Runtime', value: config.runtime },
        { label: 'Memory', value: `${config.memorySize} MB` },
        { label: 'Timeout', value: `${config.timeout}s` },
        { label: 'Env vars', value: String(envCount) },
      ],
    };
  },
};
