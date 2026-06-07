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

export const ebsConfigSchema = z.object({
  volumeName: z.string().min(1, 'Volume name is required.'),
  volumeType: z.enum(['gp3', 'gp2', 'io1', 'io2', 'st1', 'sc1']),
  sizeGb: z.number().min(1, 'Size must be at least 1 GiB.'),
  encrypted: z.boolean(),
});

export const fsxConfigSchema = z.object({
  fileSystemName: z.string().min(1, 'File system name is required.'),
  fileSystemType: z.enum(['WINDOWS', 'LUSTRE', 'NETAPP_ONTAP', 'OPENZFS']),
  storageCapacityGb: z
    .number()
    .min(1, 'Storage capacity must be at least 1 GiB.'),
});

export const auroraConfigSchema = z.object({
  clusterIdentifier: z.string().min(1, 'Cluster identifier is required.'),
  engine: z.enum(['aurora-mysql', 'aurora-postgresql']),
  engineVersion: z.string(),
  serverless: z.boolean(),
});

export const elasticacheConfigSchema = z.object({
  clusterName: z.string().min(1, 'Cluster name is required.'),
  engine: z.enum(['redis', 'memcached']),
  cacheNodeType: z.string().min(1, 'Cache node type is required.'),
  numCacheNodes: z.number().min(1, 'Must have at least 1 cache node.'),
});

export const redshiftConfigSchema = z.object({
  clusterIdentifier: z.string().min(1, 'Cluster identifier is required.'),
  nodeType: z.string().min(1, 'Node type is required.'),
  numberOfNodes: z.number().min(1, 'Must have at least 1 node.'),
  databaseName: z.string().min(1, 'Database name is required.'),
});

export const xrayConfigSchema = z.object({
  groupName: z.string().min(1, 'Group name is required.'),
  samplingRate: z
    .number()
    .min(1, 'Sampling rate must be at least 1%.')
    .max(100, 'Sampling rate cannot exceed 100%.'),
});

export const transitGatewayConfigSchema = z.object({
  transitGatewayName: z.string().min(1, 'Transit Gateway Name is required.'),
  amazonSideAsn: z
    .number()
    .refine(
      (val) =>
        (val >= 64512 && val <= 65534) ||
        (val >= 4200000000 && val <= 4294967294),
      'ASN must be in range 64512–65534 or 4200000000–4294967294.',
    ),
});

export const networkAclConfigSchema = z.object({
  aclName: z.string().min(1, 'ACL Name is required.'),
  defaultAction: z.enum(['allow', 'deny']),
});

export const route53ConfigSchema = z.object({
  hostedZoneName: z.string().min(1, 'Hosted Zone Name is required.'),
  zoneType: z.enum(['public', 'private']),
});

export const ecsClusterConfigSchema = z.object({
  clusterName: z.string().min(1, 'Cluster Name is required.'),
  launchType: z.enum(['FARGATE', 'EC2', 'EXTERNAL']),
});

export const eksClusterConfigSchema = z.object({
  clusterName: z.string().min(1, 'Cluster Name is required.'),
  kubernetesVersion: z.string().min(1, 'Kubernetes Version is required.'),
});

export const batchConfigSchema = z.object({
  computeEnvironmentName: z
    .string()
    .min(1, 'Compute Environment Name is required.'),
  computeType: z.enum(['EC2', 'FARGATE', 'SPOT']),
});

export const codepipelineConfigSchema = z.object({
  pipelineName: z.string().min(1, 'Pipeline name is required.'),
  pipelineType: z.enum(['V1', 'V2']),
});

export const codebuildConfigSchema = z.object({
  projectName: z.string().min(1, 'Project name is required.'),
  buildImage: z.string().min(1, 'Build image is required.'),
  computeType: z.enum([
    'BUILD_GENERAL1_SMALL',
    'BUILD_GENERAL1_MEDIUM',
    'BUILD_GENERAL1_LARGE',
  ]),
});

export const codedeployConfigSchema = z.object({
  applicationName: z.string().min(1, 'Application name is required.'),
  computePlatform: z.enum(['Server', 'Lambda', 'ECS']),
});

export const appRunnerConfigSchema = z.object({
  serviceName: z.string().min(1, 'Service name is required.'),
  cpu: z.enum(['0.25 vCPU', '0.5 vCPU', '1 vCPU', '2 vCPU']),
  memory: z.enum(['0.5 GB', '1 GB', '2 GB', '3 GB', '4 GB']),
});

export const elasticBeanstalkConfigSchema = z.object({
  applicationName: z.string().min(1, 'Application name is required.'),
  platform: z.string().min(1, 'Platform is required.'),
  environmentTier: z.enum(['WebServer', 'Worker']),
});

export const amazonMqConfigSchema = z.object({
  brokerName: z.string().min(1, 'Broker name is required.'),
  engineType: z.enum(['ACTIVEMQ', 'RABBITMQ']),
  hostInstanceType: z.string().min(1, 'Host instance type is required.'),
  deploymentMode: z.enum([
    'SINGLE_INSTANCE',
    'ACTIVE_STANDBY_MULTI_AZ',
    'CLUSTER_MULTI_AZ',
  ]),
});

export const cloudfrontConfigSchema = z.object({
  distributionName: z.string().min(1, 'Distribution name is required.'),
  priceClass: z.enum(['PriceClass_100', 'PriceClass_200', 'PriceClass_All']),
  viewerProtocolPolicy: z.enum([
    'allow-all',
    'redirect-to-https',
    'https-only',
  ]),
});

export const wafConfigSchema = z.object({
  webAclName: z.string().min(1, 'Web ACL name is required.'),
  scope: z.enum(['REGIONAL', 'CLOUDFRONT']),
  defaultAction: z.enum(['ALLOW', 'BLOCK']),
});

export const acmConfigSchema = z.object({
  certificateName: z.string().min(1, 'Certificate name is required.'),
  domainName: z.string().min(1, 'Domain name is required.'),
  validationMethod: z.enum(['DNS', 'EMAIL']),
});

export const mskConfigSchema = z.object({
  clusterName: z.string().min(1, 'Cluster name is required.'),
  kafkaVersion: z.string().min(1, 'Kafka version is required.'),
  brokerInstanceType: z.string().min(1, 'Broker instance type is required.'),
  brokerCount: z.number().min(1, 'Broker count must be at least 1.'),
});

export const appsyncConfigSchema = z.object({
  apiName: z.string().min(1, 'API name is required.'),
  authenticationType: z.enum([
    'API_KEY',
    'AWS_IAM',
    'AMAZON_COGNITO_USER_POOLS',
    'OPENID_CONNECT',
    'AWS_LAMBDA',
  ]),
  apiType: z.enum(['GRAPHQL', 'MERGED']),
});

export const athenaConfigSchema = z.object({
  workGroupName: z.string().min(1, 'Workgroup name is required.'),
  outputLocation: z.string().min(1, 'Output location is required.'),
  engineVersion: z.enum(['AUTO', 'Athena engine version 3']),
});

export const glueConfigSchema = z.object({
  databaseName: z.string().min(1, 'Database name is required.'),
  crawlerName: z.string().min(1, 'Crawler name is required.'),
  dataSourceType: z.enum(['S3', 'JDBC', 'DynamoDB', 'Kafka']),
});

export const opensearchConfigSchema = z.object({
  domainName: z.string().min(1, 'Domain name is required.'),
  engineVersion: z.string().min(1, 'Engine version is required.'),
  instanceType: z.string().min(1, 'Instance type is required.'),
});

export const sagemakerConfigSchema = z.object({
  notebookName: z.string().min(1, 'Notebook name is required.'),
  instanceType: z.string().min(1, 'Instance type is required.'),
  volumeSizeGb: z.number().min(5, 'Volume size must be at least 5 GiB.'),
});

export const bedrockConfigSchema = z.object({
  agentName: z.string().min(1, 'Agent name is required.'),
  foundationModel: z.string().min(1, 'Foundation model is required.'),
  guardrailMode: z.enum(['NONE', 'ATTACHED']),
});

export const documentdbConfigSchema = z.object({
  clusterIdentifier: z.string().min(1, 'Cluster identifier is required.'),
  engineVersion: z.string().min(1, 'Engine version is required.'),
  instanceClass: z.string().min(1, 'Instance class is required.'),
});

export const neptuneConfigSchema = z.object({
  clusterIdentifier: z.string().min(1, 'Cluster identifier is required.'),
  engineVersion: z.string().min(1, 'Engine version is required.'),
  instanceClass: z.string().min(1, 'Instance class is required.'),
});

export const cloudtrailConfigSchema = z.object({
  trailName: z.string().min(1, 'Trail name is required.'),
  destinationBucketName: z.string().min(1, 'Destination bucket is required.'),
  managementEvents: z.enum(['ReadOnly', 'WriteOnly', 'All']),
});

export const ssmConfigSchema = z.object({
  parameterName: z.string().min(1, 'Parameter name is required.'),
  parameterType: z.enum(['String', 'StringList', 'SecureString']),
  tier: z.enum(['Standard', 'Advanced', 'Intelligent-Tiering']),
});

export const guarddutyConfigSchema = z.object({
  detectorName: z.string().min(1, 'Detector name is required.'),
  findingPublishingFrequency: z.enum([
    'FIFTEEN_MINUTES',
    'ONE_HOUR',
    'SIX_HOURS',
  ]),
});

export const nlbConfigSchema = z.object({
  loadBalancerName: z.string().min(1, 'Load balancer name is required.'),
  scheme: z.enum(['internet-facing', 'internal']),
  ipAddressType: z.enum(['ipv4', 'dualstack']),
});

export const vpcEndpointConfigSchema = z.object({
  endpointName: z.string().min(1, 'Endpoint name is required.'),
  endpointType: z.enum(['Interface', 'Gateway', 'GatewayLoadBalancer']),
  serviceName: z.string().min(1, 'Service name is required.'),
});

export const sesConfigSchema = z.object({
  identityName: z.string().min(1, 'Identity name is required.'),
  identityType: z.enum(['EmailAddress', 'Domain']),
  mailFromDomain: z.string().min(1, 'MAIL FROM domain is required.'),
});
