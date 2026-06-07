export type VpcEndpointType = 'Interface' | 'Gateway' | 'GatewayLoadBalancer';

export type VpcEndpointConfig = {
  endpointName: string;
  endpointType: VpcEndpointType;
  serviceName: string;
};
