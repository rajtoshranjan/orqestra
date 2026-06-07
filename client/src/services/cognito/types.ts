export type CognitoMFAConfiguration = 'OFF' | 'OPTIONAL' | 'ON';

export type CognitoConfig = {
  userPoolName: string;
  mfaConfiguration: CognitoMFAConfiguration;
  selfSignUpEnabled: boolean;
};
