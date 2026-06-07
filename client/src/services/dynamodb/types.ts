export type DynamoDBConfig = {
  tableName: string;
  hashKey: string;
  hashKeyType: 'S' | 'N' | 'B';
  rangeKey?: string;
  rangeKeyType?: 'S' | 'N' | 'B';
  billingMode: 'PAY_PER_REQUEST' | 'PROVISIONED';
  streamEnabled: boolean;
  streamViewType?:
    | 'NEW_IMAGE'
    | 'OLD_IMAGE'
    | 'NEW_AND_OLD_IMAGES'
    | 'KEYS_ONLY';
};
