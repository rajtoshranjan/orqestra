import { Globe } from 'lucide-react';
import type { ServiceDefinition, ServicePlanResource } from '../types';
import type { RegionConfig } from './types';
import { createDefaultRegionConfig, getRegionDisplayName } from './defaults';
import { validateRegionConfig } from './validate';
import { RegionNode } from './region-node';
import { RegionInspector } from './region-inspector';

export const regionService: ServiceDefinition<RegionConfig> = {
  id: 'region',
  cloudFormationType: 'AWS::Region',
  name: 'AWS Region',
  shortName: 'Region',
  category: 'boundaries',
  description: 'Physical location where AWS resources are clustered.',
  icon: Globe,
  accentColor: '#3b82f6',
  capabilities: {
    provides: ['regional-container'],
  },
  allowedParents: ['account', 'environment'],
  isContainer: true,

  createDefaultConfig: createDefaultRegionConfig,
  validate: validateRegionConfig,
  getDisplayName: getRegionDisplayName,

  NodeComponent: RegionNode,
  InspectorComponent: RegionInspector,

  buildPlanResource: (
    nodeId: string,
    config: RegionConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::Region',
      name: getRegionDisplayName(config),
      connectionCount,
      details: [{ label: 'Region Name', value: config.regionName }],
    };
  },
};
export default regionService;
