import type { SNSConfig } from './types';

export function createDefaultSNSConfig(index: number): SNSConfig {
  return {
    topicName: `topic-${index}`,
    fifoTopic: false,
  };
}

export function getSNSDisplayName(config: SNSConfig): string {
  return config.topicName.trim() || 'SNS Topic';
}
