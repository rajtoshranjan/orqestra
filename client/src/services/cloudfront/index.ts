import type {
  ServiceDefinition,
  ServicePlanResource,
  AIHints,
  DeploymentHints,
} from '../types';
import type { CloudFrontConfig } from './types';
import {
  createDefaultCloudFrontConfig,
  getCloudFrontDisplayName,
} from './defaults';
import { validateCloudFrontConfig } from './validate';
import { CloudFrontNode } from './cloudfront-node';
import { CloudFrontInspector } from './cloudfront-inspector';
import { CloudFrontIcon } from '@/components/icons';

export const cloudFrontService: ServiceDefinition<CloudFrontConfig> = {
  id: 'cloudfront',
  cloudFormationType: 'AWS::CloudFront::Distribution',
  name: 'Amazon CloudFront',
  shortName: 'CloudFront',
  category: 'networking',
  description:
    'Content delivery network for caching and securely serving applications at the edge.',
  icon: CloudFrontIcon,
  accentColor: '#8C4FFF',
  capabilities: {
    provides: ['cdn-edge'],
  },
  allowedParents: ['account', 'region'],
  allowedRelationships: [
    's3',
    'alb',
    'api-gateway',
    'route53',
    'waf',
    'acm',
    'cloudwatch',
    'lambda',
  ],

  createDefaultConfig: createDefaultCloudFrontConfig,
  validate: validateCloudFrontConfig,
  getDisplayName: getCloudFrontDisplayName,

  NodeComponent: CloudFrontNode,
  InspectorComponent: CloudFrontInspector,

  aiHints: {
    summary: 'CDN service that caches content and routes requests at the edge.',
    role: 'Serves public traffic close to users while integrating with origins and edge security.',
    useCases: [
      'Static site delivery',
      'Global API acceleration',
      'Edge TLS termination',
      'Origin protection with WAF',
    ],
    keyAttributes: ['distributionName', 'priceClass', 'viewerProtocolPolicy'],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,

  buildPlanResource: (
    nodeId: string,
    config: CloudFrontConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::CloudFront::Distribution',
      name: getCloudFrontDisplayName(config),
      connectionCount,
      details: [
        { label: 'Price Class', value: config.priceClass },
        { label: 'Protocol', value: config.viewerProtocolPolicy },
      ],
    };
  },
};

export default cloudFrontService;
