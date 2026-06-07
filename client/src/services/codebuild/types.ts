export type CodeBuildConfig = {
  projectName: string;
  buildImage: string;
  computeType:
    | 'BUILD_GENERAL1_SMALL'
    | 'BUILD_GENERAL1_MEDIUM'
    | 'BUILD_GENERAL1_LARGE';
};
