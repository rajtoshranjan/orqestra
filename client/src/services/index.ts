/**
 * Services Index — All AWS services are registered here.
 *
 * To add a new service:
 * 1. Create src/services/<service-id>/ with types, defaults, validate, Node, Inspector, index.ts
 * 2. Import and register below
 * 3. That's it — zero framework code changes needed.
 */
import { accountService } from './account';
import { acmService } from './acm';
import { albService } from './alb';
import { amazonMqService } from './amazon-mq';
import { apiGatewayService } from './api-gateway';
import { appGroupService } from './app-group';
import { appRunnerService } from './app-runner';
import { appSyncService } from './appsync';
import { athenaService } from './athena';
import { auroraService } from './aurora';
import { azService } from './availability-zone';
import { batchService } from './batch';
import { bedrockService } from './bedrock';
import { cloudFrontService } from './cloudfront';
import { cloudTrailService } from './cloudtrail';
import { cloudwatchService } from './cloudwatch';
import { codebuildService } from './codebuild';
import { codedeployService } from './codedeploy';
import { codepipelineService } from './codepipeline';
import { cognitoService } from './cognito';
import { documentDbService } from './documentdb';
import { dynamodbService } from './dynamodb';
import { ebsService } from './ebs';
import { ec2Service } from './ec2';
import { ecrService } from './ecr';
import { ecsClusterService } from './ecs-cluster';
import { efsService } from './efs';
import { eksClusterService } from './eks-cluster';
import { elasticBeanstalkService } from './elastic-beanstalk';
import { elasticacheService } from './elasticache';
import { environmentService } from './environment';
import { eventbridgeService } from './eventbridge';
import { fsxService } from './fsx';
import { glueService } from './glue';
import { guardDutyService } from './guardduty';
import { iamRoleService } from './iam-role';
import { internetGatewayService } from './internet-gateway';
import { kinesisService } from './kinesis';
import { kmsService } from './kms';
import { lambdaService } from './lambda';
import { lambdaLayerService } from './lambda-layer';
import { mskService } from './msk';
import { natGatewayService } from './nat-gateway';
import { neptuneService } from './neptune';
import { networkAclService } from './network-acl';
import { nlbService } from './nlb';
import { openSearchService } from './opensearch';
import { rdsService } from './rds';
import { redshiftService } from './redshift';
import { regionService } from './region';
import { registry } from './registry';
import { routeTableService } from './route-table';
import { route53Service } from './route53';
import { s3Service } from './s3';
import { sageMakerService } from './sagemaker';
import { secretsManagerService } from './secrets-manager';
import { securityGroupService } from './security-group';
import { sesService } from './ses';
import { sharedServicesService } from './shared-services';
import { snsService } from './sns';
import { sqsService } from './sqs';
import { ssmService } from './ssm';
import { stepFunctionService } from './step-function';
import { subnetService } from './subnet';
import { transitGatewayService } from './transit-gateway';
import { trustBoundaryService } from './trust-boundary';
import { vpcService } from './vpc';
import { vpcEndpointService } from './vpc-endpoint';
import { wafService } from './waf';
import { xrayService } from './xray';

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
