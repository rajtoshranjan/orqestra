/**
 * Services Index — All AWS services are registered here.
 *
 * To add a new service:
 * 1. Create src/services/<service-id>/ with types, defaults, validate, Node, Inspector, index.ts
 * 2. Import and register below
 * 3. That's it — zero framework code changes needed.
 */
import { registry } from './registry';
import { lambdaService } from './lambda';
import { vpcService } from './vpc';
import { subnetService } from './subnet';
import { securityGroupService } from './security-group';
import { iamRoleService } from './iam-role';
import { ecrService } from './ecr';
import { efsService } from './efs';
import { lambdaLayerService } from './lambda-layer';
import { apiGatewayService } from './api-gateway';
import { eventbridgeService } from './eventbridge';
import { sqsService } from './sqs';
import { snsService } from './sns';
import { dynamodbService } from './dynamodb';
import { s3Service } from './s3';
import { kinesisService } from './kinesis';
import { stepFunctionService } from './step-function';
import { regionService } from './region';
import { azService } from './availability-zone';
import { environmentService } from './environment';
import { appGroupService } from './app-group';
import { trustBoundaryService } from './trust-boundary';
import { sharedServicesService } from './shared-services';
import { accountService } from './account';
import { natGatewayService } from './nat-gateway';
import { internetGatewayService } from './internet-gateway';
import { routeTableService } from './route-table';
import { ec2Service } from './ec2';
import { albService } from './alb';
import { cloudwatchService } from './cloudwatch';
import { rdsService } from './rds';
import { kmsService } from './kms';
import { secretsManagerService } from './secrets-manager';
import { cognitoService } from './cognito';
import { transitGatewayService } from './transit-gateway';
import { networkAclService } from './network-acl';
import { route53Service } from './route53';
import { ecsClusterService } from './ecs-cluster';
import { eksClusterService } from './eks-cluster';
import { batchService } from './batch';
import { ebsService } from './ebs';
import { fsxService } from './fsx';
import { auroraService } from './aurora';
import { elasticacheService } from './elasticache';
import { redshiftService } from './redshift';
import { xrayService } from './xray';
import { codepipelineService } from './codepipeline';
import { codebuildService } from './codebuild';
import { codedeployService } from './codedeploy';
import { appRunnerService } from './app-runner';
import { elasticBeanstalkService } from './elastic-beanstalk';
import { amazonMqService } from './amazon-mq';
import { cloudFrontService } from './cloudfront';
import { wafService } from './waf';
import { acmService } from './acm';
import { mskService } from './msk';
import { appSyncService } from './appsync';
import { athenaService } from './athena';
import { glueService } from './glue';
import { openSearchService } from './opensearch';
import { sageMakerService } from './sagemaker';
import { bedrockService } from './bedrock';
import { documentDbService } from './documentdb';
import { neptuneService } from './neptune';
import { cloudTrailService } from './cloudtrail';
import { ssmService } from './ssm';
import { guardDutyService } from './guardduty';
import { nlbService } from './nlb';
import { vpcEndpointService } from './vpc-endpoint';
import { sesService } from './ses';

// Register all services.
registry.register(lambdaService);
registry.register(vpcService);
registry.register(subnetService);
registry.register(securityGroupService);
registry.register(iamRoleService);
registry.register(ecrService);
registry.register(efsService);
registry.register(lambdaLayerService);
registry.register(apiGatewayService);
registry.register(eventbridgeService);
registry.register(sqsService);
registry.register(snsService);
registry.register(dynamodbService);
registry.register(s3Service);
registry.register(kinesisService);
registry.register(stepFunctionService);
registry.register(regionService);
registry.register(azService);
registry.register(environmentService);
registry.register(appGroupService);
registry.register(trustBoundaryService);
registry.register(sharedServicesService);
registry.register(accountService);
registry.register(natGatewayService);
registry.register(internetGatewayService);
registry.register(routeTableService);
registry.register(ec2Service);
registry.register(albService);
registry.register(cloudwatchService);
registry.register(rdsService);
registry.register(kmsService);
registry.register(secretsManagerService);
registry.register(cognitoService);
registry.register(transitGatewayService);
registry.register(networkAclService);
registry.register(route53Service);
registry.register(ecsClusterService);
registry.register(eksClusterService);
registry.register(batchService);
registry.register(ebsService);
registry.register(fsxService);
registry.register(auroraService);
registry.register(elasticacheService);
registry.register(redshiftService);
registry.register(xrayService);
registry.register(codepipelineService);
registry.register(codebuildService);
registry.register(codedeployService);
registry.register(appRunnerService);
registry.register(elasticBeanstalkService);
registry.register(amazonMqService);
registry.register(cloudFrontService);
registry.register(wafService);
registry.register(acmService);
registry.register(mskService);
registry.register(appSyncService);
registry.register(athenaService);
registry.register(glueService);
registry.register(openSearchService);
registry.register(sageMakerService);
registry.register(bedrockService);
registry.register(documentDbService);
registry.register(neptuneService);
registry.register(cloudTrailService);
registry.register(ssmService);
registry.register(guardDutyService);
registry.register(nlbService);
registry.register(vpcEndpointService);
registry.register(sesService);

// Re-export for convenience.
export { registry } from './registry';
export type {
  ServiceDefinition,
  ServiceCategory,
  ServiceValidationErrors,
  ServiceNodeProps,
  ServiceInspectorProps,
  ServicePlanResource,
} from './types';
