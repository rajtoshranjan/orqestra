export type AppRunnerConfig = {
  serviceName: string;
  cpu: '0.25 vCPU' | '0.5 vCPU' | '1 vCPU' | '2 vCPU';
  memory: '0.5 GB' | '1 GB' | '2 GB' | '3 GB' | '4 GB';
};
