import type { DiagramNode, DiagramEdge } from '@/types';

import { registry } from '../services/registry';

export type DerivedNodeConfig = {
  executionRole?: {
    id: string;
    name: string;
    arn: string;
  };
  ecrRepository?: {
    id: string;
    name: string;
    repositoryUrl: string;
  };
  subnets: Array<{
    id: string;
    name: string;
    cidrBlock: string;
    subnetType: 'public' | 'private';
  }>;
  securityGroups: Array<{
    id: string;
    name: string;
  }>;
  vpc?: {
    id: string;
    name: string;
    cidrBlock: string;
  };
  region?: {
    id: string;
    name: string;
  };
  efs?: {
    id: string;
    name: string;
    accessPointArn?: string;
  };
  layers: Array<{
    id: string;
    name: string;
  }>;
};

const staticProvides: Record<string, string[]> = {
  lambda: ['compute'],
  ecr: ['compute-artifact'],
  'iam-role': ['execution-role'],
  subnet: ['network-attachment'],
  efs: ['file-system'],
  'lambda-layer': ['lambda-layer'],
  vpc: ['network-container'],
  'security-group': ['firewall-config'],
  'api-gateway': ['event-source'],
  eventbridge: ['event-source'],
  sqs: ['event-source'],
  sns: ['event-source'],
  dynamodb: ['event-source'],
  s3: ['event-source'],
  kinesis: ['event-source'],
  'step-function': ['event-source'],
  region: ['regional-container'],
};

function getProvidesCapabilities(serviceId: string): string[] {
  const service = registry.find(serviceId);
  return service?.capabilities?.provides || staticProvides[serviceId] || [];
}

export type GraphDerivationResult = Record<string, DerivedNodeConfig>;

export function deriveGraphConfigurations(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
): GraphDerivationResult {
  const result: GraphDerivationResult = {};
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Helper to find all nodes of a certain capability type connected to a given nodeId
  const findConnectedNodesByCapability = (
    nodeId: string,
    capability: string,
  ) => {
    const connected: DiagramNode[] = [];
    for (const edge of edges) {
      if (edge.source === nodeId || edge.target === nodeId) {
        const otherId = edge.source === nodeId ? edge.target : edge.source;
        const otherNode = nodeMap.get(otherId);
        if (otherNode) {
          const provides = getProvidesCapabilities(otherNode.data.serviceId);
          if (provides.includes(capability)) {
            connected.push(otherNode);
          }
        }
      }
    }
    return connected;
  };

  // Helper to find ancestor node of a specific service type
  const findAncestorByServiceId = (
    nodeId: string,
    serviceId: string,
  ): DiagramNode | null => {
    let current = nodeMap.get(nodeId);
    while (current?.parentNode) {
      const parent = nodeMap.get(current.parentNode);
      if (!parent) break;
      if (parent.data.serviceId === serviceId) {
        return parent;
      }
      current = parent;
    }
    return null;
  };

  for (const node of nodes) {
    const serviceId = node.data.serviceId;

    if (serviceId === 'lambda') {
      const derived: DerivedNodeConfig = {
        subnets: [],
        securityGroups: [],
        layers: [],
      };

      // 1. IAM Role (execution-role)
      const roles = findConnectedNodesByCapability(node.id, 'execution-role');
      if (roles.length > 0) {
        const roleNode = roles[0];
        const roleConfig = roleNode.data.config as any;
        derived.executionRole = {
          id: roleNode.id,
          name: roleConfig.roleName || roleNode.data.label,
          arn: `arn:aws:iam::123456789012:role/${roleConfig.roleName || 'role'}`,
        };
      }

      // 2. ECR Repository (compute-artifact)
      const artifacts = findConnectedNodesByCapability(
        node.id,
        'compute-artifact',
      );
      if (artifacts.length > 0) {
        const ecrNode = artifacts[0];
        const ecrConfig = ecrNode.data.config as any;
        derived.ecrRepository = {
          id: ecrNode.id,
          name: ecrConfig.repositoryName || ecrNode.data.label,
          repositoryUrl: `${ecrConfig.repositoryName || 'repo'}.dkr.ecr.us-east-1.amazonaws.com`,
        };
      }

      // 3. Subnets (network-attachment)
      // Check connected subnets AND ancestor subnets
      const subnets = [
        ...findConnectedNodesByCapability(node.id, 'network-attachment'),
      ];
      const ancestorSubnet = findAncestorByServiceId(node.id, 'subnet');
      if (ancestorSubnet && !subnets.some((s) => s.id === ancestorSubnet.id)) {
        subnets.push(ancestorSubnet);
      }

      for (const subNode of subnets) {
        const subConfig = subNode.data.config as any;
        derived.subnets.push({
          id: subNode.id,
          name: subConfig.subnetName || subNode.data.label,
          cidrBlock: subConfig.cidrBlock || '',
          subnetType: subConfig.subnetType || 'private',
        });
      }

      // 4. VPC (network-container)
      // Check connected VPC on subnets AND ancestor VPCs
      let vpcNode = findAncestorByServiceId(node.id, 'vpc');
      if (!vpcNode && subnets.length > 0) {
        const firstSubnet = subnets[0];
        vpcNode = findAncestorByServiceId(firstSubnet.id, 'vpc');
        if (!vpcNode) {
          const vpcs = findConnectedNodesByCapability(
            firstSubnet.id,
            'network-container',
          );
          if (vpcs.length > 0) {
            vpcNode = vpcs[0];
          }
        }
      }

      if (vpcNode) {
        const vpcConfig = vpcNode.data.config as any;
        derived.vpc = {
          id: vpcNode.id,
          name: vpcConfig.vpcName || vpcNode.data.label,
          cidrBlock: vpcConfig.cidrBlock || '',
        };
      }

      // 5. Region
      const regionNode =
        findAncestorByServiceId(node.id, 'region') ||
        (vpcNode ? findAncestorByServiceId(vpcNode.id, 'region') : null);
      if (regionNode) {
        const regConfig = regionNode.data.config as any;
        derived.region = {
          id: regionNode.id,
          name: regConfig.regionName || regionNode.data.label,
        };
      }

      // 6. Security Groups (firewall-config)
      const sgs = findConnectedNodesByCapability(node.id, 'firewall-config');
      for (const sgNode of sgs) {
        const sgConfig = sgNode.data.config as any;
        derived.securityGroups.push({
          id: sgNode.id,
          name: sgConfig.groupName || sgNode.data.label,
        });
      }

      // 7. EFS (file-system)
      const filesystems = findConnectedNodesByCapability(
        node.id,
        'file-system',
      ).filter((n) => n.data.serviceId === 'efs');
      if (filesystems.length > 0) {
        const efsNode = filesystems[0];
        const efsConfig = efsNode.data.config as any;
        const apName = efsConfig.accessPoints?.[0]?.name || 'default';
        derived.efs = {
          id: efsNode.id,
          name: efsConfig.creationToken || efsNode.data.label,
          accessPointArn: `arn:aws:elasticfilesystem:us-east-1:123456789012:access-point/${apName}`,
        };
      }

      // 8. Layers (lambda-layer)
      const layers = findConnectedNodesByCapability(node.id, 'lambda-layer');
      for (const layerNode of layers) {
        const layerConfig = layerNode.data.config as any;
        derived.layers.push({
          id: layerNode.id,
          name: layerConfig.layerName || layerNode.data.label,
        });
      }

      result[node.id] = derived;
    }
  }

  return result;
}
