export type ConnectivityType = 'public' | 'private';

export type NatGatewayConfig = {
  natGatewayName: string;
  connectivityType: ConnectivityType;
};
