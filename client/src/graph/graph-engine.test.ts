import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { DiagramNode, DiagramEdge } from '@/types';

import { GraphEngine } from './graph-engine';

/* Mock the service registry so tests don't depend on real service definitions. */
vi.mock('@/services/registry', () => ({
  registry: {
    find: (serviceId: string) => {
      const capabilities: Record<string, string[]> = {
        'iam-role': ['execution-role'],
        subnet: ['network-attachment'],
        vpc: ['network-container'],
        'security-group': ['firewall-config'],
        efs: ['file-system'],
        cloudwatch: ['monitoring-service'],
        kms: ['encryption-key'],
      };
      return capabilities[serviceId]
        ? { capabilities: { provides: capabilities[serviceId] } }
        : null;
    },
  },
}));

function makeNode(
  id: string,
  serviceId: string,
  parentNode?: string,
): DiagramNode {
  return {
    id,
    type: `${serviceId}Node`,
    position: { x: 0, y: 0 },
    data: {
      serviceId,
      label: `${serviceId}-${id}`,
      config: {},
      validationErrors: {},
    },
    ...(parentNode ? { parentNode } : {}),
  } as DiagramNode;
}

function makeEdge(id: string, source: string, target: string): DiagramEdge {
  return { id, source, target } as DiagramEdge;
}

describe('GraphEngine', () => {
  let nodes: DiagramNode[];
  let edges: DiagramEdge[];

  beforeEach(() => {
    /* Build a hierarchy: region → vpc → subnet → lambda */
    nodes = [
      makeNode('region-1', 'region'),
      makeNode('vpc-1', 'vpc', 'region-1'),
      makeNode('subnet-1', 'subnet', 'vpc-1'),
      makeNode('lambda-1', 'lambda', 'subnet-1'),
      makeNode('iam-1', 'iam-role'),
      makeNode('sg-1', 'security-group', 'vpc-1'),
      makeNode('cloudwatch-1', 'cloudwatch'),
    ];
    edges = [
      makeEdge('e1', 'lambda-1', 'iam-1'),
      makeEdge('e2', 'lambda-1', 'sg-1'),
      makeEdge('e3', 'lambda-1', 'cloudwatch-1'),
    ];
  });

  describe('getNode', () => {
    it('returns a node by ID', () => {
      const engine = new GraphEngine(nodes, edges);
      expect(engine.getNode('lambda-1')?.data.serviceId).toBe('lambda');
    });

    it('returns null for unknown ID', () => {
      const engine = new GraphEngine(nodes, edges);
      expect(engine.getNode('does-not-exist')).toBeNull();
    });
  });

  describe('getParent', () => {
    it('returns the direct parent node', () => {
      const engine = new GraphEngine(nodes, edges);
      expect(engine.getParent('lambda-1')?.id).toBe('subnet-1');
      expect(engine.getParent('subnet-1')?.id).toBe('vpc-1');
    });

    it('returns null for a root node', () => {
      const engine = new GraphEngine(nodes, edges);
      expect(engine.getParent('region-1')).toBeNull();
    });
  });

  describe('getAncestors', () => {
    it('returns all ancestors in order from nearest to furthest', () => {
      const engine = new GraphEngine(nodes, edges);
      const ancestors = engine.getAncestors('lambda-1');
      expect(ancestors.map((a) => a.id)).toEqual([
        'subnet-1',
        'vpc-1',
        'region-1',
      ]);
    });

    it('returns empty array for a root node', () => {
      const engine = new GraphEngine(nodes, edges);
      expect(engine.getAncestors('region-1')).toEqual([]);
    });
  });

  describe('findAncestor', () => {
    it('finds the nearest ancestor of a given service type', () => {
      const engine = new GraphEngine(nodes, edges);
      expect(engine.findAncestor('lambda-1', 'vpc')?.id).toBe('vpc-1');
      expect(engine.findAncestor('lambda-1', 'region')?.id).toBe('region-1');
    });

    it('returns null if no matching ancestor exists', () => {
      const engine = new GraphEngine(nodes, edges);
      expect(engine.findAncestor('lambda-1', 'account')).toBeNull();
    });
  });

  describe('getChildren', () => {
    it('returns direct children of a node', () => {
      const engine = new GraphEngine(nodes, edges);
      const children = engine.getChildren('vpc-1');
      expect(children.map((c) => c.id).sort()).toEqual(['sg-1', 'subnet-1']);
    });

    it('returns empty array for a leaf node', () => {
      const engine = new GraphEngine(nodes, edges);
      expect(engine.getChildren('lambda-1')).toEqual([]);
    });
  });

  describe('getDescendants', () => {
    it('returns all descendants recursively', () => {
      const engine = new GraphEngine(nodes, edges);
      const descendants = engine.getDescendants('region-1');
      expect(descendants.map((d) => d.id).sort()).toEqual([
        'lambda-1',
        'sg-1',
        'subnet-1',
        'vpc-1',
      ]);
    });

    it('returns empty array for a leaf node', () => {
      const engine = new GraphEngine(nodes, edges);
      expect(engine.getDescendants('lambda-1')).toEqual([]);
    });
  });

  describe('getConnectedNodes', () => {
    it('returns all nodes connected via edges (both directions)', () => {
      const engine = new GraphEngine(nodes, edges);
      const connected = engine.getConnectedNodes('lambda-1');
      expect(connected.map((c) => c.id).sort()).toEqual([
        'cloudwatch-1',
        'iam-1',
        'sg-1',
      ]);
    });

    it('returns empty array for a node with no edges', () => {
      const isolatedNodes = [makeNode('isolated', 'lambda')];
      const engine = new GraphEngine(isolatedNodes, []);
      expect(engine.getConnectedNodes('isolated')).toEqual([]);
    });
  });

  describe('getConnectedByServiceId', () => {
    it('filters connected nodes by service ID', () => {
      const engine = new GraphEngine(nodes, edges);
      const roles = engine.getConnectedByServiceId('lambda-1', 'iam-role');
      expect(roles.map((r) => r.id)).toEqual(['iam-1']);
    });

    it('returns empty array if no connected nodes match', () => {
      const engine = new GraphEngine(nodes, edges);
      expect(engine.getConnectedByServiceId('lambda-1', 'rds')).toEqual([]);
    });
  });

  describe('getConnectedByCapability', () => {
    it('returns nodes that provide the given capability', () => {
      const engine = new GraphEngine(nodes, edges);
      const roles = engine.getConnectedByCapability(
        'lambda-1',
        'execution-role',
      );
      expect(roles.map((r) => r.id)).toEqual(['iam-1']);
    });

    it('returns monitoring nodes for monitoring-service capability', () => {
      const engine = new GraphEngine(nodes, edges);
      const monitors = engine.getConnectedByCapability(
        'lambda-1',
        'monitoring-service',
      );
      expect(monitors.map((m) => m.id)).toEqual(['cloudwatch-1']);
    });

    it('returns empty array when no connected node provides the capability', () => {
      const engine = new GraphEngine(nodes, edges);
      expect(
        engine.getConnectedByCapability('lambda-1', 'encryption-key'),
      ).toEqual([]);
    });
  });

  describe('getNodeContext', () => {
    it('builds a complete context including region and vpc shortcuts', () => {
      const engine = new GraphEngine(nodes, edges);
      const context = engine.getNodeContext('lambda-1');

      expect(context.node.id).toBe('lambda-1');
      expect(context.parent?.id).toBe('subnet-1');
      expect(context.vpc?.id).toBe('vpc-1');
      expect(context.region?.id).toBe('region-1');
      expect(context.connectedNodes.map((n) => n.id).sort()).toEqual([
        'cloudwatch-1',
        'iam-1',
        'sg-1',
      ]);
    });

    it('throws for an unknown node ID', () => {
      const engine = new GraphEngine(nodes, edges);
      expect(() => engine.getNodeContext('unknown')).toThrow(
        '[GraphEngine] Node "unknown" not found.',
      );
    });
  });
});
