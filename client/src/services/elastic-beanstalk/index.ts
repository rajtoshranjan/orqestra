import { ElasticBeanstalkIcon } from '@/components/icons';

import {
  createDefaultElasticBeanstalkConfig,
  getElasticBeanstalkDisplayName,
} from './defaults';
import { ElasticBeanstalkInspector } from './elastic-beanstalk-inspector';
import { ElasticBeanstalkNode } from './elastic-beanstalk-node';
import { validateElasticBeanstalkConfig } from './validate';

import type {
  ServiceDefinition,
  ServicePlanResource,
  AIHints,
  DeploymentHints,
} from '../types';
import type { ElasticBeanstalkConfig } from './types';

export const elasticBeanstalkService: ServiceDefinition<ElasticBeanstalkConfig> =
  {
    id: 'elastic-beanstalk',
    cloudFormationType: 'AWS::ElasticBeanstalk::Application',
    name: 'AWS Elastic Beanstalk',
    shortName: 'Beanstalk',
    category: 'compute',
    description:
      'PaaS for deploying and scaling web applications without managing the underlying infrastructure.',
    icon: ElasticBeanstalkIcon,
    accentColor: '#FF9900',
    capabilities: {
      provides: ['paas-platform'],
    },
    allowedParents: ['account', 'region', 'vpc'],
    allowedRelationships: [
      'rds',
      'elasticache',
      's3',
      'cloudwatch',
      'iam-role',
      'sns',
    ],

    createDefaultConfig: createDefaultElasticBeanstalkConfig,
    validate: validateElasticBeanstalkConfig,
    getDisplayName: getElasticBeanstalkDisplayName,

    NodeComponent: ElasticBeanstalkNode,
    InspectorComponent: ElasticBeanstalkInspector,

    aiHints: {
      summary:
        'PaaS for deploying web applications without managing infrastructure.',
      role: 'Abstracts infrastructure management for web apps and worker services.',
      useCases: [
        'Web application hosting',
        'Legacy app modernisation',
        'Quick deployments without DevOps overhead',
      ],
      keyAttributes: ['applicationName', 'platform', 'environmentTier'],
    } satisfies AIHints,

    deploymentHints: { isDeployable: true } satisfies DeploymentHints,

    buildPlanResource: (
      nodeId: string,
      config: ElasticBeanstalkConfig,
      connectionCount: number,
    ): ServicePlanResource => {
      return {
        id: nodeId,
        cloudFormationType: 'AWS::ElasticBeanstalk::Application',
        name: getElasticBeanstalkDisplayName(config),
        connectionCount,
        details: [
          { label: 'Platform', value: config.platform },
          { label: 'Tier', value: config.environmentTier },
        ],
      };
    },
  };

export default elasticBeanstalkService;
