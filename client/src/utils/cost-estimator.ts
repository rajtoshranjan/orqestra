import type { DiagramNode, DiagramEdge } from '@/types';

export type CostBreakdown = {
  lambda: number;
  nat: number;
  efs: number;
  apigw: number;
  databases: number;
  queues: number;
  total: number;
  worstCaseTotal: number;
  costDrivers: string[];
};

export function estimateMonthlyCost(
  nodes: DiagramNode[],
  _edges: DiagramEdge[],
): CostBreakdown {
  void _edges;
  let lambdaCost = 0;
  let lambdaWorstCase = 0;
  let natCost = 0;
  let efsCost = 0;
  let apigwCost = 0;
  let dbCost = 0;
  let queueCost = 0;

  const costDrivers: string[] = [];
  const baselineRequests = 1_000_000; // 1 Million requests/month baseline
  const baselineDurationSec = 0.5; // 500 ms baseline execution duration

  const hasPrivateSubnet = nodes.some(
    (n) =>
      n.data.serviceId === 'subnet' && n.data.config?.subnetType === 'private',
  );

  // 1. NAT Gateway hourly cost if there is a private subnet needing internet
  if (hasPrivateSubnet) {
    natCost = 0.045 * 24 * 30.5; // ~$33 / month
    costDrivers.push('NAT Gateway ($33/mo for private subnets outbound)');
  }

  for (const node of nodes) {
    const serviceId = node.data.serviceId;
    const config = (node.data.config || {}) as any;

    if (serviceId === 'lambda') {
      const memory = config.memorySize || 256;
      const timeout = config.timeout || 15;
      const provisioned = config.provisionedConcurrency || 0;

      // Compute Gb-Seconds
      const gb = memory / 1024;

      // Baseline usage
      const gbSeconds = gb * baselineDurationSec * baselineRequests;
      const computeCost = gbSeconds * 0.0000166667;
      const requestCost = (baselineRequests / 1_000_000) * 0.2;
      lambdaCost += computeCost + requestCost;

      // Worst Case (running at full timeout limit)
      const wcGbSeconds = gb * timeout * baselineRequests;
      const wcComputeCost = wcGbSeconds * 0.0000166667;
      lambdaWorstCase += wcComputeCost + requestCost;

      // Provisioned Concurrency
      if (provisioned > 0) {
        const pcDurationHrs = 24 * 30.5;
        const pcComputeCost =
          provisioned * gb * pcDurationHrs * 3600 * 0.0000097222;
        const pcInitCost = provisioned * pcDurationHrs * 3600 * 0.0000041667;
        lambdaCost += pcComputeCost + pcInitCost;
        lambdaWorstCase += pcComputeCost + pcInitCost;
        costDrivers.push(
          `Lambda Provisioned Concurrency (${provisioned} provisioned instances)`,
        );
      }
    } else if (serviceId === 'efs') {
      // Base EFS storage: assume 10 GB baseline
      efsCost += 10 * 0.3; // $3.00 / month
      costDrivers.push('EFS Standard Storage ($0.30/GB-month)');
    } else if (serviceId === 'api-gateway') {
      const apiType = config.apiType || 'HTTP';
      if (apiType === 'REST') {
        apigwCost += (baselineRequests / 1_000_000) * 3.5; // $3.50 per M
      } else {
        apigwCost += (baselineRequests / 1_000_000) * 1.0; // $1.00 per M
      }
    } else if (serviceId === 'dynamodb') {
      // DynamoDB: baseline read/writes
      dbCost += (baselineRequests / 1_000_000) * 0.25; // $0.25 per M writes
    } else if (serviceId === 'sqs' || serviceId === 'sns') {
      queueCost += (baselineRequests / 1_000_000) * 0.4; // $0.40 per M
    }
  }

  // Include static elements in total sums
  const total = lambdaCost + natCost + efsCost + apigwCost + dbCost + queueCost;
  const worstCaseTotal =
    lambdaWorstCase + natCost + efsCost + apigwCost + dbCost + queueCost;

  return {
    lambda: Math.round(lambdaCost * 100) / 100,
    nat: Math.round(natCost * 100) / 100,
    efs: Math.round(efsCost * 100) / 100,
    apigw: Math.round(apigwCost * 100) / 100,
    databases: Math.round(dbCost * 100) / 100,
    queues: Math.round(queueCost * 100) / 100,
    total: Math.round(total * 100) / 100,
    worstCaseTotal: Math.round(worstCaseTotal * 100) / 100,
    costDrivers:
      costDrivers.length > 0 ? costDrivers : ['Standard Compute Operations'],
  };
}
