import type { IAMRoleConfig } from './types';

export const DEFAULT_TRUST_POLICY = `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}`;

export function createDefaultIAMRoleConfig(index: number): IAMRoleConfig {
  return {
    roleName: `iam-role-${index}`,
    description: 'Lambda execution role created by Orqestra',
    assumeRolePolicyDocument: DEFAULT_TRUST_POLICY,
    managedPolicyArns: [
      'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
    ],
    inlinePolicies: [],
  };
}

export function getIAMRoleDisplayName(config: IAMRoleConfig): string {
  return config.roleName.trim() || 'IAM Role';
}
