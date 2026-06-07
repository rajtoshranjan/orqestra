export type SecurityGroupRule = {
  id: string;
  protocol: string;
  fromPort: number;
  toPort: number;
  cidrBlock: string;
};

export type SecurityGroupConfig = {
  groupName: string;
  description: string;
  ingressRules: SecurityGroupRule[];
  egressRules: SecurityGroupRule[];
};
