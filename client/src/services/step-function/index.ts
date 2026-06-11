import type { ServiceDefinition, ServicePlanResource } from '../types';
import type { StepFunctionConfig } from './types';
import {
  createDefaultStepFunctionConfig,
  getStepFunctionDisplayName,
} from './defaults';
import { validateStepFunctionConfig } from './validate';
import { StepFunctionNode } from './step-function-node';
import { StepFunctionInspector } from './step-function-inspector';
import { StepFunctionIcon } from '@/components/icons';

export const stepFunctionService: ServiceDefinition<StepFunctionConfig> = {
  id: 'step-function',
  cloudFormationType: 'AWS::StepFunctions::StateMachine',
  name: 'AWS Step Functions',
  shortName: 'Step Functions',
  category: 'integration',
  description:
    'Step Functions State Machine — orchestrate microservices, serverless applications, and workflows.',
  icon: StepFunctionIcon,
  accentColor: '#E7157B',
  capabilities: {
    provides: ['event-source'],
  },

  createDefaultConfig: createDefaultStepFunctionConfig,
  validate: validateStepFunctionConfig,
  getDisplayName: getStepFunctionDisplayName,

  NodeComponent: StepFunctionNode,
  InspectorComponent: StepFunctionInspector,

  buildPlanResource: (
    nodeId: string,
    config: StepFunctionConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::StepFunctions::StateMachine',
      name: getStepFunctionDisplayName(config),
      connectionCount,
      details: [{ label: 'Type', value: config.type }],
    };
  },
};
export default stepFunctionService;
