export type AthenaEngineVersion = 'AUTO' | 'Athena engine version 3';

export type AthenaConfig = {
  workGroupName: string;
  outputLocation: string;
  engineVersion: AthenaEngineVersion;
};
