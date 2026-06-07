import type { StepFunctionConfig } from './types';

export const DEFAULT_SFN_DEFINITION = `{
  "Comment": "A Hello World State Machine",
  "StartAt": "Hello",
  "States": {
    "Hello": {
      "Type": "Pass",
      "Result": "Hello from Orqestra!",
      "End": true
    }
  }
}`;

export function createDefaultStepFunctionConfig(
  index: number,
): StepFunctionConfig {
  return {
    stateMachineName: `state-machine-${index}`,
    definition: DEFAULT_SFN_DEFINITION,
    type: 'STANDARD',
  };
}

export function getStepFunctionDisplayName(config: StepFunctionConfig): string {
  return config.stateMachineName.trim() || 'State Machine';
}
