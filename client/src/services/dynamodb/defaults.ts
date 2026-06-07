import type { DynamoDBConfig } from './types';

export function createDefaultDynamoDBConfig(index: number): DynamoDBConfig {
  return {
    tableName: `table-${index}`,
    hashKey: 'id',
    hashKeyType: 'S',
    billingMode: 'PAY_PER_REQUEST',
    streamEnabled: false,
  };
}

export function getDynamoDBDisplayName(config: DynamoDBConfig): string {
  return config.tableName.trim() || 'DynamoDB Table';
}
