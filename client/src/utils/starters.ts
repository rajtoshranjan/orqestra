import { createServiceNode } from './diagram';
import type { DiagramNode, DiagramEdge } from '@/types';

/**
 * Serverless REST API Starter
 * API Gateway -> Lambda -> DynamoDB, executes via IAM Role
 */
export function createServerlessApiTemplate(): {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
} {
  const apigw = createServiceNode('api-gateway', { x: 0, y: 0 }, 1);
  const lambda = createServiceNode('lambda', { x: 0, y: 0 }, 1);
  const ddb = createServiceNode('dynamodb', { x: 0, y: 0 }, 1);
  const iam = createServiceNode('iam-role', { x: 0, y: 0 }, 1);

  apigw.data.label = 'REST API Gateway';
  lambda.data.label = 'API Handler Lambda';
  ddb.data.label = 'App Store DynamoDB';
  iam.data.label = 'Lambda Execution Role';

  const edges: DiagramEdge[] = [
    {
      id: `edge-${apigw.id}-${lambda.id}`,
      source: apigw.id,
      target: lambda.id,
      type: 'smoothstep',
    },
    {
      id: `edge-${lambda.id}-${ddb.id}`,
      source: lambda.id,
      target: ddb.id,
      type: 'smoothstep',
    },
    {
      id: `edge-${lambda.id}-${iam.id}`,
      source: lambda.id,
      target: iam.id,
      type: 'smoothstep',
    },
  ];

  return { nodes: [apigw, lambda, ddb, iam], edges };
}

/**
 * Event-Driven Processor Starter
 * S3 -> SNS -> SQS -> Lambda, executes via IAM Role
 */
export function createEventDrivenTemplate(): {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
} {
  const s3 = createServiceNode('s3', { x: 0, y: 0 }, 1);
  const sns = createServiceNode('sns', { x: 0, y: 0 }, 1);
  const sqs = createServiceNode('sqs', { x: 0, y: 0 }, 1);
  const lambda = createServiceNode('lambda', { x: 0, y: 0 }, 1);
  const iam = createServiceNode('iam-role', { x: 0, y: 0 }, 1);

  s3.data.label = 'Assets S3 Bucket';
  sns.data.label = 'Events Topic';
  sqs.data.label = 'Processing Queue';
  lambda.data.label = 'Event Worker Lambda';
  iam.data.label = 'Worker Execution Role';

  const edges: DiagramEdge[] = [
    {
      id: `edge-${s3.id}-${sns.id}`,
      source: s3.id,
      target: sns.id,
      type: 'smoothstep',
    },
    {
      id: `edge-${sns.id}-${sqs.id}`,
      source: sns.id,
      target: sqs.id,
      type: 'smoothstep',
    },
    {
      id: `edge-${sqs.id}-${lambda.id}`,
      source: sqs.id,
      target: lambda.id,
      type: 'smoothstep',
    },
    {
      id: `edge-${lambda.id}-${iam.id}`,
      source: lambda.id,
      target: iam.id,
      type: 'smoothstep',
    },
  ];

  return { nodes: [s3, sns, sqs, lambda, iam], edges };
}

/**
 * Secure VPC Network Starter
 * Region -> VPC -> Public Subnet + Private Subnet -> Security Group + Lambda
 */
export function createSecureVpcTemplate(): {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
} {
  const region = createServiceNode('region', { x: 0, y: 0 }, 1);
  const vpc = createServiceNode('vpc', { x: 0, y: 0 }, 1);
  const subnetPub = createServiceNode('subnet', { x: 0, y: 0 }, 1);
  const subnetPriv = createServiceNode('subnet', { x: 0, y: 0 }, 2);
  const sg = createServiceNode('security-group', { x: 0, y: 0 }, 1);
  const lambda = createServiceNode('lambda', { x: 0, y: 0 }, 1);

  region.data.label = 'Region (us-east-1)';
  vpc.data.label = 'Production VPC';
  subnetPub.data.label = 'Public Subnet';
  subnetPriv.data.label = 'Private Subnet';
  sg.data.label = 'Application Security Group';
  lambda.data.label = 'Internal API Handler';

  // Nested structures (Parent IDs & Config Parent IDs)
  vpc.parentNode = region.id;
  vpc.data.config.parentId = region.id;

  subnetPub.parentNode = vpc.id;
  subnetPub.data.config.parentId = vpc.id;

  subnetPriv.parentNode = vpc.id;
  subnetPriv.data.config.parentId = vpc.id;

  sg.parentNode = vpc.id;
  sg.data.config.parentId = vpc.id;

  lambda.parentNode = subnetPriv.id;
  lambda.data.config.parentId = subnetPriv.id;

  const edges: DiagramEdge[] = [
    {
      id: `edge-${subnetPub.id}-${vpc.id}`,
      source: subnetPub.id,
      target: vpc.id,
      type: 'smoothstep',
    },
    {
      id: `edge-${subnetPriv.id}-${vpc.id}`,
      source: subnetPriv.id,
      target: vpc.id,
      type: 'smoothstep',
    },
    {
      id: `edge-${sg.id}-${vpc.id}`,
      source: sg.id,
      target: vpc.id,
      type: 'smoothstep',
    },
    {
      id: `edge-${lambda.id}-${sg.id}`,
      source: lambda.id,
      target: sg.id,
      type: 'smoothstep',
    },
  ];

  return {
    nodes: [region, vpc, subnetPub, subnetPriv, sg, lambda],
    edges,
  };
}

/**
 * Microservices App (3-Tier Serverless/Containerized hybrid)
 * Region -> VPC -> Public & Private Subnets -> API Gateway -> Public Proxy Lambda -> SQS -> Private Lambda -> DynamoDB
 */
export function createMicroservicesTemplate(): {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
} {
  const region = createServiceNode('region', { x: 0, y: 0 }, 1);
  const vpc = createServiceNode('vpc', { x: 0, y: 0 }, 1);
  const subnetPub = createServiceNode('subnet', { x: 0, y: 0 }, 1);
  const subnetPriv = createServiceNode('subnet', { x: 0, y: 0 }, 2);

  const apigw = createServiceNode('api-gateway', { x: 0, y: 0 }, 1);
  const proxyLambda = createServiceNode('lambda', { x: 0, y: 0 }, 1);
  const queue = createServiceNode('sqs', { x: 0, y: 0 }, 1);
  const workerLambda = createServiceNode('lambda', { x: 0, y: 0 }, 2);
  const ddb = createServiceNode('dynamodb', { x: 0, y: 0 }, 1);
  const iam = createServiceNode('iam-role', { x: 0, y: 0 }, 1);

  region.data.label = 'Region (us-east-1)';
  vpc.data.label = 'Microservices VPC';
  subnetPub.data.label = 'Public DMZ Subnet';
  subnetPriv.data.label = 'Private Core Subnet';

  apigw.data.label = 'Customer Entry API';
  proxyLambda.data.label = 'Public API Proxy';
  queue.data.label = 'Ingress Queue';
  workerLambda.data.label = 'Core Worker Lambda';
  ddb.data.label = 'Core DynamoDB Storage';
  iam.data.label = 'Monitored Execution IAM Role';

  // Nested structures
  vpc.parentNode = region.id;
  vpc.data.config.parentId = region.id;

  subnetPub.parentNode = vpc.id;
  subnetPub.data.config.parentId = vpc.id;

  subnetPriv.parentNode = vpc.id;
  subnetPriv.data.config.parentId = vpc.id;

  proxyLambda.parentNode = subnetPub.id;
  proxyLambda.data.config.parentId = subnetPub.id;

  queue.parentNode = subnetPriv.id;
  queue.data.config.parentId = subnetPriv.id;

  workerLambda.parentNode = subnetPriv.id;
  workerLambda.data.config.parentId = subnetPriv.id;

  const edges: DiagramEdge[] = [
    {
      id: `edge-${apigw.id}-${proxyLambda.id}`,
      source: apigw.id,
      target: proxyLambda.id,
      type: 'smoothstep',
    },
    {
      id: `edge-${proxyLambda.id}-${queue.id}`,
      source: proxyLambda.id,
      target: queue.id,
      type: 'smoothstep',
    },
    {
      id: `edge-${queue.id}-${workerLambda.id}`,
      source: queue.id,
      target: workerLambda.id,
      type: 'smoothstep',
    },
    {
      id: `edge-${workerLambda.id}-${ddb.id}`,
      source: workerLambda.id,
      target: ddb.id,
      type: 'smoothstep',
    },
    {
      id: `edge-${proxyLambda.id}-${iam.id}`,
      source: proxyLambda.id,
      target: iam.id,
      type: 'smoothstep',
    },
    {
      id: `edge-${workerLambda.id}-${iam.id}`,
      source: workerLambda.id,
      target: iam.id,
      type: 'smoothstep',
    },
  ];

  return {
    nodes: [
      region,
      vpc,
      subnetPub,
      subnetPriv,
      apigw,
      proxyLambda,
      queue,
      workerLambda,
      ddb,
      iam,
    ],
    edges,
  };
}
