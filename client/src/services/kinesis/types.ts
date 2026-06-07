export type KinesisConfig = {
  streamName: string;
  shardCount: number;
  retentionPeriod: number;
};
