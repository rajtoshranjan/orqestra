import { Grid } from 'lucide-react';

import { AZInspector } from './az-inspector';
import { AZNode } from './az-node';
import { createDefaultAZConfig, getAZDisplayName } from './defaults';
import { validateAZConfig } from './validate';

import type { ServiceDefinition, ServicePlanResource } from '../types';
import type { AZConfig } from './types';

export const azService: ServiceDefinition<AZConfig> = {
  id: 'availability-zone',
  cloudFormationType: 'AWS::AZ',
  name: 'AWS AZ',
  shortName: 'AZ',
  category: 'boundaries',
  description:
    'Isolated location within an AWS Region designed to be fault-tolerant.',
  icon: Grid,
  accentColor: '#6b7280',
  capabilities: {
    provides: ['az-container'],
  },
  allowedParents: ['region', 'account', 'environment'],
  isContainer: true,

  createDefaultConfig: createDefaultAZConfig,
  validate: validateAZConfig,
  getDisplayName: getAZDisplayName,

  NodeComponent: AZNode,
  InspectorComponent: AZInspector,

  buildPlanResource: (
    nodeId: string,
    config: AZConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::AZ',
      name: getAZDisplayName(config),
      connectionCount,
      details: [{ label: 'AZ Name', value: config.zoneName }],
    };
  },
};
export default azService;
