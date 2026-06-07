import type {
  ServiceDefinition,
  ServicePlanResource,
  AIHints,
  DeploymentHints,
} from '../types';
import type { NetworkAclConfig } from './types';
import {
  createDefaultNetworkAclConfig,
  getNetworkAclDisplayName,
} from './defaults';
import { validateNetworkAclConfig } from './validate';
import { NetworkAclNode } from './network-acl-node';
import { NetworkAclInspector } from './network-acl-inspector';
import { NetworkAclIcon } from '@/components/aws-icons';

export const networkAclService: ServiceDefinition<NetworkAclConfig> = {
  id: 'network-acl',
  cloudFormationType: 'AWS::EC2::NetworkAcl',
  name: 'Network ACL',
  shortName: 'NACL',
  category: 'networking',
  description:
    'Stateless subnet-level firewall controlling inbound and outbound traffic for an additional layer of network security.',
  icon: NetworkAclIcon,
  accentColor: '#29B0D9',
  capabilities: {
    provides: ['network-acl'],
  },
  allowedParents: ['vpc', 'subnet', 'region'],
  allowedRelationships: ['subnet', 'vpc'],

  createDefaultConfig: createDefaultNetworkAclConfig,
  validate: validateNetworkAclConfig,
  getDisplayName: getNetworkAclDisplayName,

  NodeComponent: NetworkAclNode,
  InspectorComponent: NetworkAclInspector,

  aiHints: {
    summary:
      'Stateless subnet-level firewall controlling inbound and outbound traffic.',
    role: 'Provides an additional layer of network security at the subnet boundary.',
    useCases: [
      'Subnet-level traffic filtering',
      'Defence in depth alongside Security Groups',
      'Blocking specific CIDR ranges',
    ],
    keyAttributes: ['aclName', 'defaultAction'],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,

  buildPlanResource: (
    nodeId: string,
    config: NetworkAclConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::EC2::NetworkAcl',
      name: getNetworkAclDisplayName(config),
      connectionCount,
      details: [{ label: 'Default', value: config.defaultAction }],
    };
  },
};

export default networkAclService;
