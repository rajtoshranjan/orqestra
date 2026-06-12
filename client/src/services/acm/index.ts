import { AcmIcon } from '@/components/icons';

import { AcmInspector } from './acm-inspector';
import { AcmNode } from './acm-node';
import { createDefaultAcmConfig, getAcmDisplayName } from './defaults';
import { validateAcmConfig } from './validate';

import type {
  ServiceDefinition,
  ServicePlanResource,
  AIHints,
  DeploymentHints,
} from '../types';
import type { AcmConfig } from './types';

export const acmService: ServiceDefinition<AcmConfig> = {
  id: 'acm',
  cloudFormationType: 'AWS::CertificateManager::Certificate',
  name: 'AWS Certificate Manager',
  shortName: 'ACM',
  category: 'security',
  description:
    'Managed TLS certificate service for securing AWS application endpoints.',
  icon: AcmIcon,
  accentColor: '#DD344C',
  capabilities: {
    provides: ['tls-certificate'],
  },
  allowedParents: ['account', 'region'],
  allowedRelationships: ['cloudfront', 'alb', 'api-gateway', 'route53', 'nlb'],

  createDefaultConfig: createDefaultAcmConfig,
  validate: validateAcmConfig,
  getDisplayName: getAcmDisplayName,

  NodeComponent: AcmNode,
  InspectorComponent: AcmInspector,

  aiHints: {
    summary: 'Managed TLS certificate used by AWS public endpoints.',
    role: 'Provides certificates for HTTPS termination and domain validation.',
    useCases: [
      'CloudFront HTTPS',
      'Load balancer certificates',
      'API Gateway custom domains',
    ],
    keyAttributes: ['certificateName', 'domainName', 'validationMethod'],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,

  buildPlanResource: (
    nodeId: string,
    config: AcmConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::CertificateManager::Certificate',
      name: getAcmDisplayName(config),
      connectionCount,
      details: [
        { label: 'Domain', value: config.domainName },
        { label: 'Validation', value: config.validationMethod },
      ],
    };
  },
};

export default acmService;
