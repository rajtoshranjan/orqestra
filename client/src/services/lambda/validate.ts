import type { ServiceValidationErrors } from '../types';
import type { LambdaConfig } from './types';

export function validateLambdaConfig(
  config: LambdaConfig,
): ServiceValidationErrors {
  const errors: ServiceValidationErrors = {};
  const trimmedName = config.functionName.trim();
  const trimmedHandler = config.handler.trim();
  const nonEmptyEnvVars = config.environmentVariables.filter(
    (e) => e.key.trim() || e.value.trim(),
  );

  if (!trimmedName) {
    errors.functionName = 'Function name is required.';
  } else if (!/^[a-zA-Z0-9-_]{1,64}$/.test(trimmedName)) {
    errors.functionName = 'Use 1-64 letters, numbers, hyphens, or underscores.';
  }

  if (!config.runtime) errors.runtime = 'Choose a Lambda runtime.';
  if (!trimmedHandler) errors.handler = 'Handler is required.';
  if (!config.code.trim())
    errors.code = 'Paste the function code before planning or deploying.';

  if (
    !Number.isFinite(config.memorySize) ||
    config.memorySize < 128 ||
    config.memorySize > 10240
  ) {
    errors.memorySize = 'Memory must be between 128 MB and 10240 MB.';
  }

  if (
    !Number.isFinite(config.timeout) ||
    config.timeout < 1 ||
    config.timeout > 900
  ) {
    errors.timeout = 'Timeout must be between 1 and 900 seconds.';
  }

  const seenEnvKeys = new Set<string>();
  for (const entry of nonEmptyEnvVars) {
    const key = entry.key.trim();
    if (!key) {
      errors.environmentVariables = 'Each environment variable needs a key.';
      break;
    }
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) {
      errors.environmentVariables =
        'Environment keys must start with a letter and use only letters, numbers, or underscores.';
      break;
    }
    if (seenEnvKeys.has(key)) {
      errors.environmentVariables = 'Environment variable keys must be unique.';
      break;
    }
    seenEnvKeys.add(key);
  }

  return errors;
}
