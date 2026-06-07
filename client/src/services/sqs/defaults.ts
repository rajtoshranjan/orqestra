import type { SQSConfig } from './types';

export function createDefaultSQSConfig(index: number): SQSConfig {
  return {
    queueName: `queue-${index}`,
    fifoQueue: false,
    visibilityTimeoutSeconds: 30,
    messageRetentionSeconds: 345600,
    delaySeconds: 0,
  };
}

export function getSQSDisplayName(config: SQSConfig): string {
  return config.queueName.trim() || 'SQS Queue';
}
