export type AppSyncAuthenticationType =
  | 'API_KEY'
  | 'AWS_IAM'
  | 'AMAZON_COGNITO_USER_POOLS'
  | 'OPENID_CONNECT'
  | 'AWS_LAMBDA';

export type AppSyncApiType = 'GRAPHQL' | 'MERGED';

export type AppSyncConfig = {
  apiName: string;
  authenticationType: AppSyncAuthenticationType;
  apiType: AppSyncApiType;
};
