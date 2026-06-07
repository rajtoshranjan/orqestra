import { describe, it, expect } from 'vitest';
import { estimateMonthlyCost } from './cost-estimator';
import type { DiagramNode, DiagramEdge } from '@/types';

describe('cost estimator utility', () => {
  const emptyEdges: DiagramEdge[] = [];

  const makeNode = (
    id: string,
    serviceId: string,
    config: Record<string, any> = {},
  ): DiagramNode => ({
    id,
    type: serviceId,
    position: { x: 0, y: 0 },
    data: {
      serviceId,
      label: serviceId,
      config,
      validationErrors: {},
    },
  });

  it('should return zero costs for empty diagram', () => {
    const breakdown = estimateMonthlyCost([], emptyEdges);
    expect(breakdown.total).toBe(0);
    expect(breakdown.lambda).toBe(0);
    expect(breakdown.nat).toBe(0);
    expect(breakdown.efs).toBe(0);
    expect(breakdown.apigw).toBe(0);
    expect(breakdown.databases).toBe(0);
    expect(breakdown.queues).toBe(0);
    expect(breakdown.costDrivers).toContain('Standard Compute Operations');
  });

  it('should estimate cost for a standard ZIP lambda function correctly', () => {
    const lambda = makeNode('lambda-1', 'lambda', {
      memorySize: 256,
      timeout: 15,
      provisionedConcurrency: 0,
    });

    const breakdown = estimateMonthlyCost([lambda], emptyEdges);

    // gb = 256/1024 = 0.25
    // gbSeconds = 0.25 * 0.500 * 1,000,000 = 125,000
    // computeCost = 125,000 * 0.0000166667 = 2.0833375
    // requestCost = 1 * 0.20 = 0.20
    // lambdaCost = 2.0833375 + 0.2 = 2.2833375 => 2.28
    expect(breakdown.lambda).toBe(2.28);

    // wcGbSeconds = 0.25 * 15 * 1,000,000 = 3,750,000
    // wcComputeCost = 3,750,000 * 0.0000166667 = 62.500125
    // lambdaWorstCase = 62.500125 + 0.2 = 62.700125 => 62.7
    expect(breakdown.worstCaseTotal).toBe(62.7);
    expect(breakdown.total).toBe(2.28);
  });

  it('should include Provisioned Concurrency costs when configured', () => {
    const lambda = makeNode('lambda-1', 'lambda', {
      memorySize: 1024,
      timeout: 3,
      provisionedConcurrency: 2,
    });

    const breakdown = estimateMonthlyCost([lambda], emptyEdges);

    // Base usage:
    // gb = 1
    // gbSeconds = 1 * 0.5 * 1,000,000 = 500,000
    // computeCost = 500,000 * 0.0000166667 = 8.33335
    // requestCost = 0.20
    // baseLambda = 8.53335
    //
    // PC usage:
    // pcDurationHrs = 732
    // pcCompute = 2 * 1 * 732 * 3600 * 0.0000097222 = 51.240097
    // pcInit = 2 * 732 * 3600 * 0.0000041667 = 21.96018
    // total = 8.53335 + 51.240083 + 21.96018 = 81.7336 => 81.73
    expect(breakdown.lambda).toBe(81.73);
    expect(breakdown.costDrivers).toContain(
      'Lambda Provisioned Concurrency (2 provisioned instances)',
    );
  });

  it('should include NAT Gateway driver if private subnet is present', () => {
    const lambda = makeNode('lambda-1', 'lambda', { memorySize: 128 });
    const subnet = makeNode('sub-1', 'subnet', { subnetType: 'private' });

    const breakdown = estimateMonthlyCost([lambda, subnet], emptyEdges);

    // nat = 0.045 * 24 * 30.5 = 32.94
    expect(breakdown.nat).toBe(32.94);
    expect(breakdown.costDrivers).toContain(
      'NAT Gateway ($33/mo for private subnets outbound)',
    );
  });

  it('should calculate EFS standard storage cost correctly', () => {
    const efs = makeNode('efs-1', 'efs');
    const breakdown = estimateMonthlyCost([efs], emptyEdges);

    // efsCost = 10 * 0.30 = 3.00
    expect(breakdown.efs).toBe(3.0);
    expect(breakdown.costDrivers).toContain(
      'EFS Standard Storage ($0.30/GB-month)',
    );
  });

  it('should estimate REST and HTTP API Gateway costs differently', () => {
    const restApigw = makeNode('apigw-1', 'api-gateway', { apiType: 'REST' });
    const httpApigw = makeNode('apigw-2', 'api-gateway', { apiType: 'HTTP' });

    const restBreakdown = estimateMonthlyCost([restApigw], emptyEdges);
    const httpBreakdown = estimateMonthlyCost([httpApigw], emptyEdges);

    // REST: (1,000,000 / 1,000,000) * 3.50 = 3.50
    // HTTP: (1,000,000 / 1,000,000) * 1.00 = 1.00
    expect(restBreakdown.apigw).toBe(3.5);
    expect(httpBreakdown.apigw).toBe(1.0);
  });

  it('should estimate database, SQS, and SNS costs correctly', () => {
    const ddb = makeNode('ddb-1', 'dynamodb');
    const sqs = makeNode('sqs-1', 'sqs');
    const sns = makeNode('sns-1', 'sns');

    const breakdown = estimateMonthlyCost([ddb, sqs, sns], emptyEdges);

    // DynamoDB: 1 * 0.25 = 0.25
    expect(breakdown.databases).toBe(0.25);
    // SQS + SNS: 2 * (1 * 0.40) = 0.80
    expect(breakdown.queues).toBe(0.8);
    expect(breakdown.total).toBe(1.05);
  });
});
