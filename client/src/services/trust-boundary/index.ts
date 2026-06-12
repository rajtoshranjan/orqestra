import { Shield } from 'lucide-react';

import { TrustBoundaryInspector } from './boundary-inspector';
import { TrustBoundaryNode } from './boundary-node';
import {
  createDefaultTrustBoundaryConfig,
  getTrustBoundaryDisplayName,
} from './defaults';
import { validateTrustBoundaryConfig } from './validate';

import type { ServiceDefinition, ServicePlanResource } from '../types';
import type { TrustBoundaryConfig } from './types';

export const trustBoundaryService: ServiceDefinition<TrustBoundaryConfig> = {
  id: 'trust-boundary',
  cloudFormationType: 'AWS::TrustBoundary',
  name: 'Trust Boundary',
  shortName: 'TrustBoundary',
  category: 'boundaries',
  description: 'Visual trust border or security perimeter.',
  icon: Shield,
  accentColor: '#ef4444',
  capabilities: {
    provides: ['trust-boundary-container'],
  },
  allowedParents: ['region', 'vpc', 'subnet', 'environment', 'app-group'],
  isContainer: true,

  createDefaultConfig: createDefaultTrustBoundaryConfig,
  validate: validateTrustBoundaryConfig,
  getDisplayName: getTrustBoundaryDisplayName,

  NodeComponent: TrustBoundaryNode,
  InspectorComponent: TrustBoundaryInspector,

  buildPlanResource: (
    nodeId: string,
    config: TrustBoundaryConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::TrustBoundary',
      name: getTrustBoundaryDisplayName(config),
      connectionCount,
      details: [{ label: 'Boundary Name', value: config.boundaryName }],
    };
  },
};
export default trustBoundaryService;
