import type { AmazonMqConfig } from './types';

export function createDefaultAmazonMqConfig(index: number): AmazonMqConfig {
  return {
    brokerName: `mq-broker-${index}`,
    engineType: 'RABBITMQ',
    hostInstanceType: 'mq.t3.micro',
    deploymentMode: 'SINGLE_INSTANCE',
  };
}

export function getAmazonMqDisplayName(config: AmazonMqConfig): string {
  return config.brokerName.trim() || 'Amazon MQ';
}
