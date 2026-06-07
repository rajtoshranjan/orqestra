export type AmazonMqConfig = {
  brokerName: string;
  engineType: 'ACTIVEMQ' | 'RABBITMQ';
  hostInstanceType: string;
  deploymentMode:
    | 'SINGLE_INSTANCE'
    | 'ACTIVE_STANDBY_MULTI_AZ'
    | 'CLUSTER_MULTI_AZ';
};
