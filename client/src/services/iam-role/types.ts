export type IAMPolicyRule = {
  id: string;
  name: string;
  document: string;
};

export type IAMRoleConfig = {
  roleName: string;
  description: string;
  assumeRolePolicyDocument: string;
  managedPolicyArns: string[];
  inlinePolicies: IAMPolicyRule[];
};
