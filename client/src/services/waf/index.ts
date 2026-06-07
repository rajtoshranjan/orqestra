import type {
  ServiceDefinition,
  ServicePlanResource,
  AIHints,
  DeploymentHints,
} from '../types';
import type { WafConfig } from './types';
import { createDefaultWafConfig, getWafDisplayName } from './defaults';
import { validateWafConfig } from './validate';
import { WafNode } from './waf-node';
import { WafInspector } from './waf-inspector';
import { WafIcon } from '@/components/aws-icons';

export const wafService: ServiceDefinition<WafConfig> = {
  id: 'waf',
  cloudFormationType: 'AWS::WAFv2::WebACL',
  name: 'AWS WAF',
  shortName: 'WAF',
  category: 'security',
  description:
    'Web application firewall for protecting CloudFront, ALB, and API Gateway endpoints.',
  icon: WafIcon,
  accentColor: '#DD344C',
  capabilities: {
    provides: ['web-firewall'],
  },
  allowedParents: ['account', 'region'],
  allowedRelationships: [
    'cloudfront',
    'alb',
    'api-gateway',
    'cloudwatch',
    'guardduty',
  ],

  createDefaultConfig: createDefaultWafConfig,
  validate: validateWafConfig,
  getDisplayName: getWafDisplayName,

  NodeComponent: WafNode,
  InspectorComponent: WafInspector,

  aiHints: {
    summary: 'Web application firewall for HTTP and HTTPS workloads.',
    role: 'Protects public application entry points with request filtering rules.',
    useCases: [
      'Block malicious requests',
      'Attach managed rule groups',
      'Protect CDN and load balancer origins',
    ],
    keyAttributes: ['webAclName', 'scope', 'defaultAction'],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,

  buildPlanResource: (
    nodeId: string,
    config: WafConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::WAFv2::WebACL',
      name: getWafDisplayName(config),
      connectionCount,
      details: [
        { label: 'Scope', value: config.scope },
        { label: 'Default Action', value: config.defaultAction },
      ],
    };
  },
};

export default wafService;
