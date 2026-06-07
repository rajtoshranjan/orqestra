export type APIRoute = {
  id: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'ANY';
};

export type APIGatewayConfig = {
  apiName: string;
  apiType: 'REST' | 'HTTP' | 'WEBSOCKET';
  stageName: string;
  routes: APIRoute[];
};
