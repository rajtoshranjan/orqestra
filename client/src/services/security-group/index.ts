import type {
  ServiceDefinition,
  ServicePlanResource,
  ValidationRule,
  SecurityScanRule,
  AIHints,
} from '../types';
import type { SecurityGroupConfig } from './types';
import {
  createDefaultSecurityGroupConfig,
  getSecurityGroupDisplayName,
} from './defaults';
import { validateSecurityGroupConfig } from './validate';
import { SecurityGroupNode } from './security-group-node';
import { SecurityGroupInspector } from './security-group-inspector';
import { SecurityGroupIcon } from '@/components/aws-icons';

export const securityGroupService: ServiceDefinition<SecurityGroupConfig> = {
  id: 'security-group',
  cloudFormationType: 'AWS::EC2::SecurityGroup',
  name: 'AWS Security Group',
  shortName: 'Security Group',
  category: 'networking',
  description:
    'Security group acting as a virtual firewall for cloud resources to control inbound and outbound traffic.',
  icon: SecurityGroupIcon,
  accentColor: '#3F8624',
  capabilities: {
    provides: ['firewall-config'],
  },

  validationRules: [
    {
      id: 'security-group-requires-vpc',
      message: 'Security Group must be placed inside or connected to a VPC.',
      check: ({ node, nodes, edges }) => {
        let current = nodes.find((n) => n.id === node.parentNode);
        while (current) {
          if (current.data.serviceId === 'vpc') return false;
          current = nodes.find((n) => n.id === current!.parentNode);
        }
        const hasVpcEdge = edges.some((edge) => {
          const otherId = edge.source === node.id ? edge.target : edge.source;
          return nodes.find((n) => n.id === otherId)?.data.serviceId === 'vpc';
        });
        return !hasVpcEdge;
      },
    },
  ] satisfies ValidationRule[],

  securityRules: [
    {
      id: 'sg-wildcard-ingress',
      severity: 'medium',
      title: 'Open Ingress Firewall Rules',
      description: (name) =>
        `Security group "${name}" allows incoming traffic from any IP (0.0.0.0/0). Ensure this is intentional for production.`,
      check: (config) => {
        const ingress =
          (config.ingressRules as Array<{ cidrBlock?: string }>) ?? [];
        return ingress.some((rule) => rule.cidrBlock === '0.0.0.0/0');
      },
    },
  ] satisfies SecurityScanRule[],

  aiHints: {
    summary:
      'Virtual firewall that controls inbound and outbound traffic for AWS resources.',
    role: 'Enforces network-level access policies within a VPC.',
    useCases: [
      'Restricting inbound traffic to specific ports',
      'Allowing only VPC-internal communication',
      'Creating zero-trust network perimeters',
    ],
    keyAttributes: ['groupName', 'ingressRules', 'egressRules'],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true },

  createDefaultConfig: createDefaultSecurityGroupConfig,
  validate: validateSecurityGroupConfig,
  getDisplayName: getSecurityGroupDisplayName,

  NodeComponent: SecurityGroupNode,
  InspectorComponent: SecurityGroupInspector,

  buildPlanResource: (
    nodeId: string,
    config: SecurityGroupConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::EC2::SecurityGroup',
      name: getSecurityGroupDisplayName(config),
      connectionCount,
      details: [
        {
          label: 'Inbound Rules',
          value: String(config.ingressRules?.length || 0),
        },
        {
          label: 'Outbound Rules',
          value: String(config.egressRules?.length || 0),
        },
      ],
    };
  },
};
export default securityGroupService;
