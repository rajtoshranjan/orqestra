/* Lambda-specific types — only imported within the lambda service module */

export type LambdaRuntime = 'nodejs20.x' | 'nodejs22.x' | 'python3.12';

export type LambdaEnvironmentVariable = {
  id: string;
  key: string;
  value: string;
};

export type LambdaConfig = {
  functionName: string;
  runtime: LambdaRuntime;
  handler: string;
  code: string;
  environmentVariables: LambdaEnvironmentVariable[];
  memorySize: number;
  timeout: number;
  description: string;
};

export const RUNTIME_OPTIONS: Array<{ value: LambdaRuntime; label: string }> = [
  { value: 'nodejs20.x', label: 'Node.js 20' },
  { value: 'nodejs22.x', label: 'Node.js 22' },
  { value: 'python3.12', label: 'Python 3.12' },
];
