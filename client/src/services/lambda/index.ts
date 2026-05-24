import { FunctionSquare } from 'lucide-react';
import type { ServiceDefinition, ServicePlanResource } from '../types';
import type { LambdaConfig } from './types';
import { createDefaultLambdaConfig, getLambdaDisplayName } from './defaults';
import { validateLambdaConfig } from './validate';
import { LambdaNode } from './LambdaNode';
import { LambdaInspector } from './LambdaInspector';

export const lambdaService: ServiceDefinition<LambdaConfig> = {
  /* ── Identity ─────────────────────────── */
  id: 'lambda',
  cloudFormationType: 'AWS::Lambda::Function',
  name: 'AWS Lambda',
  shortName: 'Lambda',
  category: 'compute',
  description:
    'Serverless compute — run code with no servers to manage. Configure runtime, memory, timeout, handler, and environment variables.',
  icon: FunctionSquare,
  accentColor: '#3b82f6',

  /* ── Config ───────────────────────────── */
  createDefaultConfig: createDefaultLambdaConfig,
  validate: validateLambdaConfig,
  getDisplayName: getLambdaDisplayName,

  /* ── UI ────────────────────────────────── */
  NodeComponent: LambdaNode as any,
  InspectorComponent: LambdaInspector,

  /* ── Plan ──────────────────────────────── */
  buildPlanResource: (
    nodeId: string,
    config: LambdaConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    const envCount = config.environmentVariables.filter(
      (e) => e.key.trim() || e.value.trim(),
    ).length;

    return {
      id: nodeId,
      cloudFormationType: 'AWS::Lambda::Function',
      name: getLambdaDisplayName(config),
      connectionCount,
      details: [
        { label: 'Runtime', value: config.runtime },
        { label: 'Memory', value: `${config.memorySize} MB` },
        { label: 'Timeout', value: `${config.timeout}s` },
        { label: 'Env vars', value: String(envCount) },
      ],
    };
  },
};
