export type LambdaRuntime =
  | 'nodejs20.x'
  | 'nodejs22.x'
  | 'python3.12'
  | 'java17'
  | 'dotnet8'
  | 'go1.x'
  | 'ruby3.2'
  | 'provided.al2023';

export type LambdaEnvironmentVariable = {
  id: string;
  key: string;
  value: string;
};

export type LambdaConfig = {
  functionName: string;
  runtime: LambdaRuntime;
  handler: string;
  code?: string;
  environmentVariables: LambdaEnvironmentVariable[];
  memorySize: number;
  timeout: number;
  description: string;
  packageType: 'Zip' | 'Image';
  architecture: 'x86_64' | 'arm64';

  // Container settings
  imageUri?: string;
  imageTag?: string;
  imageDigest?: string;

  // Concurrency & SnapStart
  reservedConcurrency?: number | null;
  provisionedConcurrency?: number | null;
  snapStart: 'None' | 'PublishedVersions';
  ephemeralStorage: number;

  // Function URL settings
  enableFunctionUrl: boolean;
  functionUrlAuthType: 'NONE' | 'AWS_IAM';

  // Monitoring
  logRetention: number;
  tracingMode: 'Active' | 'PassThrough';
  lambdaInsights: boolean;
};

export const RUNTIME_OPTIONS: Array<{ value: LambdaRuntime; label: string }> = [
  { value: 'nodejs20.x', label: 'Node.js 20' },
  { value: 'nodejs22.x', label: 'Node.js 22' },
  { value: 'python3.12', label: 'Python 3.12' },
  { value: 'java17', label: 'Java 17 (Corretto)' },
  { value: 'dotnet8', label: '.NET 8' },
  { value: 'go1.x', label: 'Go 1.x' },
  { value: 'ruby3.2', label: 'Ruby 3.2' },
  { value: 'provided.al2023', label: 'Custom Runtime (AL2023)' },
];
