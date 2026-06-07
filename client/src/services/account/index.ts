import { ShieldCheck } from 'lucide-react';
import type { ServiceDefinition, ServicePlanResource } from '../types';
import type { AccountConfig } from './types';
import { createDefaultAccountConfig, getAccountDisplayName } from './defaults';
import { validateAccountConfig } from './validate';
import { AccountNode } from './account-node';
import { AccountInspector } from './account-inspector';

export const accountService: ServiceDefinition<AccountConfig> = {
  id: 'account',
  cloudFormationType: 'AWS::Account',
  name: 'AWS Account',
  shortName: 'Account',
  category: 'boundaries',
  description: 'Physical location mapping to an entire AWS Account context.',
  icon: ShieldCheck,
  accentColor: '#6366f1',
  capabilities: {
    provides: ['account-container'],
  },
  allowedParents: [],
  isContainer: true,

  createDefaultConfig: createDefaultAccountConfig,
  validate: validateAccountConfig,
  getDisplayName: getAccountDisplayName,

  NodeComponent: AccountNode,
  InspectorComponent: AccountInspector,

  buildPlanResource: (
    nodeId: string,
    config: AccountConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::Account',
      name: getAccountDisplayName(config),
      connectionCount,
      details: [{ label: 'Account ID', value: config.accountId }],
    };
  },
};
export default accountService;
