import type { ElasticBeanstalkConfig } from './types';

export function createDefaultElasticBeanstalkConfig(
  index: number,
): ElasticBeanstalkConfig {
  return {
    applicationName: `beanstalk-app-${index}`,
    platform: 'Node.js 20',
    environmentTier: 'WebServer',
  };
}

export function getElasticBeanstalkDisplayName(
  config: ElasticBeanstalkConfig,
): string {
  return config.applicationName.trim() || 'Elastic Beanstalk';
}
