import type { DiagramNode, DiagramEdge } from '@/types';
import { registry } from '@/services/registry';

export type NodeGraphContext = {
  node: DiagramNode;
  parent: DiagramNode | null;
  children: DiagramNode[];
  ancestors: DiagramNode[];
  descendants: DiagramNode[];
  connectedNodes: DiagramNode[];
  /** Nearest ancestor with serviceId === 'region', or null. */
  region: DiagramNode | null;
  /** Nearest ancestor with serviceId === 'vpc', or null. */
  vpc: DiagramNode | null;
};

/**
 * GraphEngine encapsulates all graph traversal and query operations.
 *
 * This is the single place for querying the architecture graph.
 * Import and instantiate this class anywhere graph traversal is needed
 * instead of writing inline ancestor-walking loops.
 *
 * @example
 * const engine = new GraphEngine(nodes, edges);
 * const iamRoles = engine.getConnectedByCapability(lambdaNodeId, 'execution-role');
 */
export class GraphEngine {
  private readonly nodeMap: Map<string, DiagramNode>;
  private readonly childrenMap: Map<string, string[]>;
  private readonly edgesByNode: Map<string, DiagramEdge[]>;

  constructor(
    private readonly nodes: DiagramNode[],
    private readonly edges: DiagramEdge[],
  ) {
    this.nodeMap = new Map(nodes.map((node) => [node.id, node]));
    this.childrenMap = this.buildChildrenMap();
    this.edgesByNode = this.buildEdgesByNode();
  }

  private buildChildrenMap(): Map<string, string[]> {
    const map = new Map<string, string[]>();
    for (const node of this.nodes) {
      if (!node.parentNode) continue;
      const children = map.get(node.parentNode) ?? [];
      children.push(node.id);
      map.set(node.parentNode, children);
    }
    return map;
  }

  private buildEdgesByNode(): Map<string, DiagramEdge[]> {
    const map = new Map<string, DiagramEdge[]>();
    for (const edge of this.edges) {
      const sourceEdges = map.get(edge.source) ?? [];
      sourceEdges.push(edge);
      map.set(edge.source, sourceEdges);

      const targetEdges = map.get(edge.target) ?? [];
      targetEdges.push(edge);
      map.set(edge.target, targetEdges);
    }
    return map;
  }

  /** Retrieve a node by ID, or null if not found. */
  getNode(nodeId: string): DiagramNode | null {
    return this.nodeMap.get(nodeId) ?? null;
  }

  /** Get the direct parent node, or null if the node is a root. */
  getParent(nodeId: string): DiagramNode | null {
    const node = this.nodeMap.get(nodeId);
    if (!node?.parentNode) return null;
    return this.nodeMap.get(node.parentNode) ?? null;
  }

  /** Get all direct children of a node. */
  getChildren(nodeId: string): DiagramNode[] {
    const childIds = this.childrenMap.get(nodeId) ?? [];
    return childIds
      .map((id) => this.nodeMap.get(id))
      .filter((node): node is DiagramNode => node !== undefined);
  }

  /** Get all ancestor nodes walking up the parent chain. */
  getAncestors(nodeId: string): DiagramNode[] {
    const ancestors: DiagramNode[] = [];
    let current = this.nodeMap.get(nodeId);
    while (current?.parentNode) {
      const parent = this.nodeMap.get(current.parentNode);
      if (!parent) break;
      ancestors.push(parent);
      current = parent;
    }
    return ancestors;
  }

  /**
   * Find the first ancestor whose serviceId matches the given value.
   * Returns null if no matching ancestor exists.
   */
  findAncestor(nodeId: string, serviceId: string): DiagramNode | null {
    let current = this.nodeMap.get(nodeId);
    while (current?.parentNode) {
      const parent = this.nodeMap.get(current.parentNode);
      if (!parent) break;
      if (parent.data.serviceId === serviceId) return parent;
      current = parent;
    }
    return null;
  }

  /** Get all descendant nodes recursively. */
  getDescendants(nodeId: string): DiagramNode[] {
    const result: DiagramNode[] = [];
    const queue = [...(this.childrenMap.get(nodeId) ?? [])];

    while (queue.length > 0) {
      const id = queue.shift()!;
      const node = this.nodeMap.get(id);
      if (!node) continue;
      result.push(node);
      queue.push(...(this.childrenMap.get(id) ?? []));
    }

    return result;
  }

  /** Get all edges involving the given node. */
  getEdgesFor(nodeId: string): DiagramEdge[] {
    return this.edgesByNode.get(nodeId) ?? [];
  }

  /** Get all nodes connected to the given node via edges. */
  getConnectedNodes(nodeId: string): DiagramNode[] {
    return this.getEdgesFor(nodeId)
      .map((edge) => {
        const otherId = edge.source === nodeId ? edge.target : edge.source;
        return this.nodeMap.get(otherId);
      })
      .filter((node): node is DiagramNode => node !== undefined);
  }

  /** Get all connected nodes whose serviceId matches. */
  getConnectedByServiceId(nodeId: string, serviceId: string): DiagramNode[] {
    return this.getConnectedNodes(nodeId).filter(
      (node) => node.data.serviceId === serviceId,
    );
  }

  /**
   * Get all connected nodes that provide the given capability.
   * Queries the service registry for capability declarations.
   */
  getConnectedByCapability(nodeId: string, capability: string): DiagramNode[] {
    return this.getConnectedNodes(nodeId).filter((node) => {
      const service = registry.find(node.data.serviceId);
      return service?.capabilities?.provides?.includes(capability) ?? false;
    });
  }

  /**
   * Build a complete context object for a node, including all graph relationships.
   * Useful for AI context serialization and complex validation rules.
   */
  getNodeContext(nodeId: string): NodeGraphContext {
    const node = this.nodeMap.get(nodeId);
    if (!node) {
      throw new Error(`[GraphEngine] Node "${nodeId}" not found.`);
    }

    return {
      node,
      parent: this.getParent(nodeId),
      children: this.getChildren(nodeId),
      ancestors: this.getAncestors(nodeId),
      descendants: this.getDescendants(nodeId),
      connectedNodes: this.getConnectedNodes(nodeId),
      region: this.findAncestor(nodeId, 'region'),
      vpc: this.findAncestor(nodeId, 'vpc'),
    };
  }

  getAllNodes(): DiagramNode[] {
    return this.nodes;
  }

  getAllEdges(): DiagramEdge[] {
    return this.edges;
  }
}
