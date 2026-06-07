export type ECRConfig = {
  repositoryName: string;
  imageTagMutability: 'MUTABLE' | 'IMMUTABLE';
  scanOnPush: boolean;
};
