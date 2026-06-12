import { describe, it, expect } from 'vitest';

import type { DiagramNode, DiagramEdge } from '@/types';

import { deriveGraphConfigurations } from './derivation-engine';

describe('derivation engine utility', () => {
  const makeNode = (
    id: string,
    serviceId: string,
    config: Record<string, any> = {},
  ): DiagramNode => ({
    id,
    type: `${serviceId}Node`,
    position: { x: 0, y: 0 },
    data: {
      serviceId,
      label: serviceId,
      config,
      validationErrors: {},
    },
  });

  it('should derive properties for a Lambda function with relationships correctly', () => {
    const lambda = makeNode('lambda-1', 'lambda', {
      functionName: 'my-lambda',
    });
    const role = makeNode('role-1', 'iam-role', { roleName: 'my-role' });
    const ecr = makeNode('ecr-1', 'ecr', { repositoryName: 'my-repo' });
    const vpc = makeNode('vpc-1', 'vpc', {
      vpcName: 'my-vpc',
      cidrBlock: '10.0.0.0/16',
    });
    const subnet = makeNode('subnet-1', 'subnet', {
      subnetName: 'my-subnet',
      cidrBlock: '10.0.1.0/24',
      subnetType: 'private',
    });
    const sg = makeNode('sg-1', 'security-group', { groupName: 'my-sg' });
    const efs = makeNode('efs-1', 'efs', {
      creationToken: 'my-efs',
      accessPoints: [{ name: 'my-ap' }],
    });
    const layer = makeNode('layer-1', 'lambda-layer', {
      layerName: 'my-layer',
    });

    const nodes = [lambda, role, ecr, vpc, subnet, sg, efs, layer];
    const edges: DiagramEdge[] = [
      { id: 'e1', source: 'lambda-1', target: 'role-1' },
      { id: 'e2', source: 'lambda-1', target: 'ecr-1' },
      { id: 'e3', source: 'lambda-1', target: 'subnet-1' },
      { id: 'e4', source: 'subnet-1', target: 'vpc-1' },
      { id: 'e5', source: 'lambda-1', target: 'sg-1' },
      { id: 'e6', source: 'lambda-1', target: 'efs-1' },
      { id: 'e7', source: 'lambda-1', target: 'layer-1' },
    ];

    const derivations = deriveGraphConfigurations(nodes, edges);
    const derived = derivations['lambda-1'];

    expect(derived).toBeDefined();
    expect(derived.executionRole?.name).toBe('my-role');
    expect(derived.executionRole?.arn).toBe(
      'arn:aws:iam::123456789012:role/my-role',
    );
    expect(derived.ecrRepository?.name).toBe('my-repo');
    expect(derived.ecrRepository?.repositoryUrl).toBe(
      'my-repo.dkr.ecr.us-east-1.amazonaws.com',
    );
    expect(derived.vpc?.name).toBe('my-vpc');
    expect(derived.subnets[0]?.name).toBe('my-subnet');
    expect(derived.subnets[0]?.subnetType).toBe('private');
    expect(derived.securityGroups[0]?.name).toBe('my-sg');
    expect(derived.efs?.name).toBe('my-efs');
    expect(derived.efs?.accessPointArn).toBe(
      'arn:aws:elasticfilesystem:us-east-1:123456789012:access-point/my-ap',
    );
    expect(derived.layers[0]?.name).toBe('my-layer');
  });

  it('should derive properties for visual nested containment recursively (Lambda inside Subnet inside VPC inside Region)', () => {
    const lambda = makeNode('lambda-1', 'lambda', {
      functionName: 'my-lambda',
    });
    const subnet = makeNode('subnet-1', 'subnet', {
      subnetName: 'my-subnet',
      cidrBlock: '10.0.1.0/24',
      subnetType: 'private',
    });
    const vpc = makeNode('vpc-1', 'vpc', {
      vpcName: 'my-vpc',
      cidrBlock: '10.0.0.0/16',
    });
    const region = makeNode('region-1', 'region', { regionName: 'us-west-2' });

    // Visual nesting hierarchy setup
    lambda.parentNode = 'subnet-1';
    subnet.parentNode = 'vpc-1';
    vpc.parentNode = 'region-1';

    const nodes = [lambda, subnet, vpc, region];
    const edges: DiagramEdge[] = []; // zero edges

    const derivations = deriveGraphConfigurations(nodes, edges);
    const derived = derivations['lambda-1'];

    expect(derived).toBeDefined();
    expect(derived.subnets[0]?.name).toBe('my-subnet');
    expect(derived.vpc?.name).toBe('my-vpc');
    expect(derived.region?.name).toBe('us-west-2');
  });
});
