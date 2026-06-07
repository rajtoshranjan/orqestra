export type SQSConfig = {
  queueName: string;
  fifoQueue: boolean;
  visibilityTimeoutSeconds: number;
  messageRetentionSeconds: number;
  delaySeconds: number;
};
