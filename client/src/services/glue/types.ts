export type GlueDataSourceType = 'S3' | 'JDBC' | 'DynamoDB' | 'Kafka';

export type GlueConfig = {
  databaseName: string;
  crawlerName: string;
  dataSourceType: GlueDataSourceType;
};
