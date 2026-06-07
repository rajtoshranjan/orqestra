import type { CognitoConfig } from './types';

export function createDefaultCognitoConfig(index: number): CognitoConfig {
  return {
    userPoolName: `user-pool-${index}`,
    mfaConfiguration: 'OFF',
    selfSignUpEnabled: true,
  };
}

export function getCognitoDisplayName(config: CognitoConfig): string {
  return config.userPoolName.trim() || 'Cognito User Pool';
}
