import { Share2 } from 'lucide-react';
import type { ServiceDefinition, ServicePlanResource } from '../types';
import type { SharedServicesConfig } from './types';
import {
  createDefaultSharedServicesConfig,
  getSharedServicesDisplayName,
} from './defaults';
import { validateSharedServicesConfig } from './validate';
import { SharedServicesNode } from './services-node';
import { SharedServicesInspector } from './services-inspector';

export const sharedServicesService: ServiceDefinition<SharedServicesConfig> = {
  id: 'shared-services',
  cloudFormationType: 'AWS::SharedServices',
  name: 'Shared Services',
  shortName: 'SharedServices',
  category: 'boundaries',
  description: 'Shared services and common resources boundary.',
  icon: Share2,
  accentColor: '#ec4899',
  capabilities: {
    provides: ['shared-services-container'],
  },
  allowedParents: ['region', 'vpc', 'environment', 'account'],
  isContainer: true,

  createDefaultConfig: createDefaultSharedServicesConfig,
  validate: validateSharedServicesConfig,
  getDisplayName: getSharedServicesDisplayName,

  NodeComponent: SharedServicesNode,
  InspectorComponent: SharedServicesInspector,

  buildPlanResource: (
    nodeId: string,
    config: SharedServicesConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::SharedServices',
      name: getSharedServicesDisplayName(config),
      connectionCount,
      details: [{ label: 'Boundary Name', value: config.servicesName }],
    };
  },
};
export default sharedServicesService;
