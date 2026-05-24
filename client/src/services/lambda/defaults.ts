import type {
  LambdaConfig,
  LambdaRuntime,
  LambdaEnvironmentVariable,
} from './types';

/* ─── ID Helper ───────────────────────────────────────────────────────── */

function makeEnvId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

/* ─── Code Templates ──────────────────────────────────────────────────── */

export const DEFAULT_NODE_CODE = `exports.handler = async (event) => {
  console.log("Incoming event", JSON.stringify(event));

  return {
    statusCode: 200,
    body: JSON.stringify({
      ok: true,
      message: "Hello from Orqestra",
      receivedAt: new Date().toISOString(),
    }),
  };
};`;

export const DEFAULT_PYTHON_CODE = `import json
from datetime import datetime

def lambda_handler(event, context):
    return {
        "statusCode": 200,
        "body": json.dumps({
            "ok": True,
            "message": "Hello from Orqestra",
            "receivedAt": datetime.utcnow().isoformat(),
        }),
    }`;

/* ─── Runtime Defaults ────────────────────────────────────────────────── */

export function getDefaultHandlerForRuntime(runtime: LambdaRuntime): string {
  return runtime === 'python3.12'
    ? 'lambda_function.lambda_handler'
    : 'index.handler';
}

export function getDefaultCodeForRuntime(runtime: LambdaRuntime): string {
  return runtime === 'python3.12' ? DEFAULT_PYTHON_CODE : DEFAULT_NODE_CODE;
}

/* ─── Factory ─────────────────────────────────────────────────────────── */

export function makeEnvironmentVariable(): LambdaEnvironmentVariable {
  return { id: makeEnvId(), key: '', value: '' };
}

export function createDefaultLambdaConfig(index: number): LambdaConfig {
  return {
    functionName: `lambda-${index}`,
    runtime: 'nodejs20.x',
    handler: getDefaultHandlerForRuntime('nodejs20.x'),
    code: getDefaultCodeForRuntime('nodejs20.x'),
    environmentVariables: [makeEnvironmentVariable()],
    memorySize: 256,
    timeout: 15,
    description: 'Created from the visual editor',
  };
}

/* ─── Display Name ────────────────────────────────────────────────────── */

export function getLambdaDisplayName(config: LambdaConfig): string {
  return config.functionName.trim() || 'Lambda Function';
}
