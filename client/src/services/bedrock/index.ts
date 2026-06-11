import type {
  ServiceDefinition,
  ServicePlanResource,
  AIHints,
  DeploymentHints,
} from '../types';
import type { BedrockConfig } from './types';
import { createDefaultBedrockConfig, getBedrockDisplayName } from './defaults';
import { validateBedrockConfig } from './validate';
import { BedrockNode } from './bedrock-node';
import { BedrockInspector } from './bedrock-inspector';
import { BedrockIcon } from '@/components/icons';

export const bedrockService: ServiceDefinition<BedrockConfig> = {
  id: 'bedrock',
  cloudFormationType: 'AWS::Bedrock::Agent',
  name: 'Amazon Bedrock',
  shortName: 'Bedrock',
  category: 'integration',
  description:
    'Managed foundation model service for building generative AI applications.',
  icon: BedrockIcon,
  accentColor: '#BF5AF2',
  capabilities: {
    provides: ['foundation-model-app'],
  },
  allowedParents: ['account', 'region'],
  allowedRelationships: [
    'lambda',
    'appsync',
    'api-gateway',
    's3',
    'opensearch',
    'iam-role',
    'cloudwatch',
    'guardduty',
  ],

  createDefaultConfig: createDefaultBedrockConfig,
  validate: validateBedrockConfig,
  getDisplayName: getBedrockDisplayName,

  NodeComponent: BedrockNode,
  InspectorComponent: BedrockInspector,

  aiHints: {
    summary: 'Foundation model service for generative AI workloads.',
    role: 'Runs model-backed agents and integrates them with application data.',
    useCases: ['AI agents', 'RAG applications', 'Generative AI APIs'],
    keyAttributes: ['agentName', 'foundationModel', 'guardrailMode'],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,

  buildPlanResource: (
    nodeId: string,
    config: BedrockConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::Bedrock::Agent',
      name: getBedrockDisplayName(config),
      connectionCount,
      details: [
        { label: 'Model', value: config.foundationModel },
        { label: 'Guardrail', value: config.guardrailMode },
      ],
    };
  },
};

export default bedrockService;
