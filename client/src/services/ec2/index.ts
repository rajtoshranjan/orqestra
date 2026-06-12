import { Ec2Icon } from '@/components/icons';

import { createDefaultEC2Config, getEC2DisplayName } from './defaults';
import { EC2Inspector } from './ec2-inspector';
import { EC2Node } from './ec2-node';
import { validateEC2Config } from './validate';

import type {
  ServiceDefinition,
  ServicePlanResource,
  ValidationRule,
  AIHints,
  DeploymentHints,
} from '../types';
import type { EC2Config } from './types';

export const ec2Service: ServiceDefinition<EC2Config> = {
  id: 'ec2',
  cloudFormationType: 'AWS::EC2::Instance',
  name: 'Amazon EC2',
  shortName: 'EC2',
  category: 'compute',
  description:
    'Virtual server in the cloud for scalable compute capacity, with full OS control and flexible configuration.',
  icon: Ec2Icon,
  accentColor: '#FF9900',
  isContainer: false,
  capabilities: {
    provides: ['compute'],
    optional: [
      'execution-role',
      'firewall-config',
      'relational-database',
      'encryption-key',
      'secret-store',
    ],
  },
  allowedParents: ['subnet', 'availability-zone', 'app-group'],
  forbiddenParents: ['s3', 'iam-role'],
  allowedRelationships: [
    'iam-role',
    'security-group',
    'kms',
    'rds',
    'dynamodb',
    'alb',
    'cloudwatch',
    'secrets-manager',
    'efs',
    'ebs',
    'documentdb',
    'neptune',
    'opensearch',
    'vpc-endpoint',
    'nlb',
    'ssm',
  ],

  createDefaultConfig: createDefaultEC2Config,
  validate: validateEC2Config,
  getDisplayName: getEC2DisplayName,

  NodeComponent: EC2Node,
  InspectorComponent: EC2Inspector,

  validationRules: [
    {
      id: 'ec2-requires-security-group',
      message:
        'EC2 instance should have a Security Group connected or as an ancestor.',
      check: ({ node, nodes, edges }) => {
        const hasSecurityGroupEdge = edges.some((edge) => {
          const otherId = edge.source === node.id ? edge.target : edge.source;
          return (
            nodes.find((n) => n.id === otherId)?.data.serviceId ===
            'security-group'
          );
        });
        if (hasSecurityGroupEdge) return false;

        let current = nodes.find((n) => n.id === node.parentNode);
        while (current) {
          if (current.data.serviceId === 'security-group') return false;
          current = nodes.find((n) => n.id === current!.parentNode);
        }
        return true;
      },
    },
  ] satisfies ValidationRule[],

  buildPlanResource: (
    nodeId: string,
    config: EC2Config,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::EC2::Instance',
      name: getEC2DisplayName(config),
      connectionCount,
      details: [{ label: 'Instance Type', value: config.instanceType }],
    };
  },

  aiHints: {
    summary:
      'Virtual server in the cloud running your operating system and applications.',
    role: 'General-purpose compute for applications requiring full OS control.',
    useCases: [
      'Web servers',
      'Application servers',
      'Database servers',
      'Development environments',
    ],
    keyAttributes: ['instanceName', 'instanceType', 'ami', 'publicIpEnabled'],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,
};

export default ec2Service;
