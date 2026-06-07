import type { KinesisConfig } from './types';

export function createDefaultKinesisConfig(index: number): KinesisConfig {
  return {
    streamName: `stream-${index}`,
    shardCount: 1,
    retentionPeriod: 24,
  };
}

export function getKinesisDisplayName(config: KinesisConfig): string {
  return config.streamName.trim() || 'Kinesis Stream';
}
