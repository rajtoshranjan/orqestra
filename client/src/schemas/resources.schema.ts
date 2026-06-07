import { z } from 'zod';

export const vpcConfigSchema = z.object({
  vpcName: z
    .string()
    .min(1, 'VPC Name is required.')
    .regex(/^[a-zA-Z0-9-_]+$/, 'Invalid characters.'),
  cidrBlock: z
    .string()
    .min(1, 'CIDR block is required.')
    .regex(
      /^([0-9]{1,3}\.){3}[0-9]{1,3}\/[0-9]{1,2}$/,
      'Must be a valid CIDR (e.g. 10.0.0.0/16).',
    ),
  enableDnsHostnames: z.boolean(),
  enableDnsSupport: z.boolean(),
});

export const subnetConfigSchema = z.object({
  subnetName: z.string().min(1, 'Subnet Name is required.'),
  cidrBlock: z
    .string()
    .min(1, 'CIDR block is required.')
    .regex(
      /^([0-9]{1,3}\.){3}[0-9]{1,3}\/[0-9]{1,2}$/,
      'Must be a valid CIDR (e.g. 10.0.1.0/24).',
    ),
  availabilityZone: z.string().min(1, 'Availability Zone is required.'),
  mapPublicIpOnLaunch: z.boolean(),
  subnetType: z.enum(['public', 'private']),
});

export const securityGroupConfigSchema = z.object({
  groupName: z.string().min(1, 'Security Group Name is required.'),
  description: z.string().min(1, 'Description is required.'),
  ingressRules: z.array(
    z.object({
      id: z.string(),
      protocol: z.string(),
      fromPort: z.number().min(-1).max(65535),
      toPort: z.number().min(-1).max(65535),
      cidrBlock: z
        .string()
        .regex(
          /^([0-9]{1,3}\.){3}[0-9]{1,3}\/[0-9]{1,2}$/,
          'Must be a valid CIDR.',
        ),
    }),
  ),
  egressRules: z.array(
    z.object({
      id: z.string(),
      protocol: z.string(),
      fromPort: z.number().min(-1).max(65535),
      toPort: z.number().min(-1).max(65535),
      cidrBlock: z
        .string()
        .regex(
          /^([0-9]{1,3}\.){3}[0-9]{1,3}\/[0-9]{1,2}$/,
          'Must be a valid CIDR.',
        ),
    }),
  ),
});

export const iamRoleConfigSchema = z.object({
  roleName: z
    .string()
    .min(1, 'Role Name is required.')
    .regex(/^[a-zA-Z0-9-_+@=,.]+$/, 'Invalid role name characters.'),
  description: z.string(),
  assumeRolePolicyDocument: z
    .string()
    .min(1, 'Trust policy document is required.'),
  managedPolicyArns: z.array(z.string()),
  inlinePolicies: z.array(
    z.object({
      id: z.string(),
      name: z.string().min(1, 'Policy name is required.'),
      document: z.string().min(1, 'Policy document is required.'),
    }),
  ),
});

export const ecrConfigSchema = z.object({
  repositoryName: z
    .string()
    .min(1, 'Repository Name is required.')
    .regex(
      /^[a-z0-9-_/]+$/,
      'Must be lowercase letters, numbers, hyphens, underscores, or slashes.',
    ),
  imageTagMutability: z.enum(['MUTABLE', 'IMMUTABLE']),
  scanOnPush: z.boolean(),
});

export const efsConfigSchema = z.object({
  creationToken: z.string().min(1, 'Creation token is required.'),
  encrypted: z.boolean(),
  performanceMode: z.enum(['generalPurpose', 'maxIO']),
  throughputMode: z.enum(['bursting', 'provisioned', 'elastic']),
  provisionedThroughputInMibps: z.number().min(0).optional(),
  accessPoints: z.array(
    z.object({
      id: z.string(),
      name: z.string().min(1, 'Access point name is required.'),
      path: z
        .string()
        .regex(
          /^\/[a-zA-Z0-9-_/]*$/,
          'Must start with a slash and use valid path characters.',
        ),
    }),
  ),
});

export const lambdaLayerConfigSchema = z.object({
  layerName: z
    .string()
    .min(1, 'Layer Name is required.')
    .regex(/^[a-zA-Z0-9-_]+$/, 'Letters, numbers, hyphens, or underscores.'),
  description: z.string(),
  compatibleRuntimes: z.array(z.string()),
  compatibleArchitectures: z.array(z.string()),
});

export const apiGatewayConfigSchema = z.object({
  apiName: z.string().min(1, 'API name is required.'),
  apiType: z.enum(['REST', 'HTTP', 'WEBSOCKET']),
  stageName: z.string().min(1, 'Stage name is required.'),
  routes: z.array(
    z.object({
      id: z.string(),
      path: z
        .string()
        .min(1, 'Path is required.')
        .startsWith('/', 'Path must start with a slash.'),
      method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ANY']),
    }),
  ),
});

export const eventbridgeConfigSchema = z.object({
  ruleName: z.string().min(1, 'Rule Name is required.'),
  scheduleExpression: z.string().optional(),
  eventPattern: z.string().optional(),
});

export const sqsConfigSchema = z.object({
  queueName: z.string().min(1, 'Queue Name is required.'),
  fifoQueue: z.boolean(),
  visibilityTimeoutSeconds: z.number().min(0).max(43200),
  messageRetentionSeconds: z.number().min(60).max(1209600),
  delaySeconds: z.number().min(0).max(900),
});

export const snsConfigSchema = z.object({
  topicName: z.string().min(1, 'Topic Name is required.'),
  fifoTopic: z.boolean(),
});

export const dynamodbConfigSchema = z.object({
  tableName: z.string().min(1, 'Table Name is required.'),
  hashKey: z.string().min(1, 'Partition key is required.'),
  hashKeyType: z.enum(['S', 'N', 'B']),
  rangeKey: z.string().optional(),
  rangeKeyType: z.enum(['S', 'N', 'B']).optional(),
  billingMode: z.enum(['PAY_PER_REQUEST', 'PROVISIONED']),
  streamEnabled: z.boolean(),
  streamViewType: z
    .enum(['NEW_IMAGE', 'OLD_IMAGE', 'NEW_AND_OLD_IMAGES', 'KEYS_ONLY'])
    .optional(),
});

export const s3ConfigSchema = z.object({
  bucketName: z
    .string()
    .min(3, 'Bucket Name must be at least 3 characters.')
    .regex(/^[a-z0-9.-]+$/, 'S3 bucket naming conventions apply.'),
  versioning: z.boolean(),
});

export const kinesisConfigSchema = z.object({
  streamName: z.string().min(1, 'Stream name is required.'),
  shardCount: z.number().min(1).max(100000),
  retentionPeriod: z.number().min(24).max(8760),
});

export const stepFunctionConfigSchema = z.object({
  stateMachineName: z.string().min(1, 'State machine name is required.'),
  definition: z.string().min(1, 'State machine ASL definition is required.'),
  type: z.enum(['STANDARD', 'EXPRESS']),
});

export const regionConfigSchema = z.object({
  regionName: z.string().min(1, 'Region name is required.'),
});

export const azConfigSchema = z.object({
  zoneName: z.string().min(1, 'Zone name is required.'),
});

export const environmentConfigSchema = z.object({
  envName: z.string().min(1, 'Environment name is required.'),
});

export const appGroupConfigSchema = z.object({
  groupName: z.string().min(1, 'Group name is required.'),
});

export const trustBoundaryConfigSchema = z.object({
  boundaryName: z.string().min(1, 'Boundary name is required.'),
});

export const sharedServicesConfigSchema = z.object({
  servicesName: z.string().min(1, 'Services name is required.'),
});

export const accountConfigSchema = z.object({
  accountId: z.string().regex(/^\d{12}$/, 'Must be a 12-digit AWS account ID.'),
});
