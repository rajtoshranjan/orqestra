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

// ── Register all services ────────────────────────────────────────────────
registry.register(lambdaService);

// Future services — just add one line each:
// import { s3Service } from "./s3";
// registry.register(s3Service);
//
// import { dynamoDbService } from "./dynamodb";
// registry.register(dynamoDbService);
//
// import { apiGatewayService } from "./api-gateway";
// registry.register(apiGatewayService);
//
// import { sqsService } from "./sqs";
// registry.register(sqsService);

// Re-export for convenience
export { registry } from './registry';
export type {
  ServiceDefinition,
  ServiceCategory,
  ServiceValidationErrors,
  ServiceNodeProps,
  ServiceInspectorProps,
  ServicePlanResource,
} from './types';
