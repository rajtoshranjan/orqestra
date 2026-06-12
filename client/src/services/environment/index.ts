import { Layers } from 'lucide-react';

import {
  createDefaultEnvironmentConfig,
  getEnvironmentDisplayName,
} from './defaults';
import { EnvInspector } from './env-inspector';
import { EnvNode } from './env-node';
import { validateEnvironmentConfig } from './validate';

import type { ServiceDefinition, ServicePlanResource } from '../types';
import type { EnvironmentConfig } from './types';

export const environmentService: ServiceDefinition<EnvironmentConfig> = {
  id: 'environment',
  cloudFormationType: 'AWS::Environment',
  name: 'Environment',
  shortName: 'Env',
  category: 'boundaries',
  description: 'Logical deployment tier (e.g. dev, staging, prod).',
  icon: Layers,
  accentColor: '#8b5cf6',
  capabilities: {
    provides: ['env-container'],
  },
  allowedParents: ['account'],
  isContainer: true,

  createDefaultConfig: createDefaultEnvironmentConfig,
  validate: validateEnvironmentConfig,
  getDisplayName: getEnvironmentDisplayName,

  NodeComponent: EnvNode,
  InspectorComponent: EnvInspector,

  buildPlanResource: (
    nodeId: string,
    config: EnvironmentConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::Environment',
      name: getEnvironmentDisplayName(config),
      connectionCount,
      details: [{ label: 'Environment Name', value: config.envName }],
    };
  },
};
export default environmentService;
