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
