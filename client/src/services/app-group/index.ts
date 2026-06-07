import { Folder } from 'lucide-react';
import type { ServiceDefinition, ServicePlanResource } from '../types';
import type { AppGroupConfig } from './types';
import {
  createDefaultAppGroupConfig,
  getAppGroupDisplayName,
} from './defaults';
import { validateAppGroupConfig } from './validate';
import { AppGroupNode } from './group-node';
import { AppGroupInspector } from './group-inspector';

export const appGroupService: ServiceDefinition<AppGroupConfig> = {
  id: 'app-group',
  cloudFormationType: 'AWS::AppGroup',
  name: 'Application Group',
  shortName: 'AppGroup',
  category: 'boundaries',
  description: 'Logical grouping of services or databases.',
  icon: Folder,
  accentColor: '#f59e0b',
  capabilities: {
    provides: ['app-group-container'],
  },
  allowedParents: ['region', 'vpc', 'subnet', 'environment'],
  isContainer: true,

  createDefaultConfig: createDefaultAppGroupConfig,
  validate: validateAppGroupConfig,
  getDisplayName: getAppGroupDisplayName,

  NodeComponent: AppGroupNode,
  InspectorComponent: AppGroupInspector,

  buildPlanResource: (
    nodeId: string,
    config: AppGroupConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::AppGroup',
      name: getAppGroupDisplayName(config),
      connectionCount,
      details: [{ label: 'Group Name', value: config.groupName }],
    };
  },
};
export default appGroupService;
