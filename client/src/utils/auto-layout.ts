import type { DiagramNode, DiagramEdge } from '@/types';

const LEAF_WIDTH = 220;
const LEAF_HEIGHT = 70;
const PADDING = 24;
const HEADER_HEIGHT = 56;
const GAP_X = 32;
const GAP_Y = 24;

const CONTAINER_SERVICE_IDS = new Set([
  'vpc',
  'subnet',
  'region',
  'availability-zone',
  'environment',
  'app-group',
  'trust-boundary',
  'shared-services',
  'account',
]);

const isContainerService = (serviceId: string): boolean => {
  return CONTAINER_SERVICE_IDS.has(serviceId);
};

export function autoLayoutDiagram(
  nodes: DiagramNode[],
  _edges: DiagramEdge[],
): DiagramNode[] {
  void _edges;
  if (nodes.length === 0) return [];

  const nodeMap = new Map(nodes.map((n) => [n.id, { ...n }]));
  const childMap = new Map<string, string[]>();

  // Initialize child map
  for (const node of nodes) {
    const parentId = node.parentNode || (node.data.config as any)?.parentId;
    if (parentId) {
      if (!childMap.has(parentId)) {
        childMap.set(parentId, []);
      }
      childMap.get(parentId)!.push(node.id);
    }
  }

  // Helper to compute node nesting depth
  const getDepth = (nodeId: string): number => {
    let depth = 0;
    let curr = nodeMap.get(nodeId);
    while (curr?.parentNode) {
      depth++;
      curr = nodeMap.get(curr.parentNode);
    }
    return depth;
  };

  // Find all containers and sort them by depth descending (deepest first)
  const containers = nodes
    .filter((n) => isContainerService(n.data.serviceId))
    .map((n) => ({ id: n.id, depth: getDepth(n.id) }))
    .sort((a, b) => b.depth - a.depth);

  // 1. Bottom-up: Calculate dimensions of all containers recursively
  for (const containerInfo of containers) {
    const container = nodeMap.get(containerInfo.id)!;
    const childrenIds = childMap.get(container.id) || [];

    if (childrenIds.length === 0) {
      // Empty container gets default sizes
      container.style = { width: 240, height: 140 };
      continue;
    }

    const children = childrenIds
      .map((cid) => nodeMap.get(cid)!)
      .filter(Boolean);
    const containerChildren = children.filter((c) =>
      isContainerService(c.data.serviceId),
    );
    const leafChildren = children.filter(
      (c) => !isContainerService(c.data.serviceId),
    );

    let currentY = HEADER_HEIGHT + PADDING;
    let maxContainerWidth = 240;

    // A. Arrange nested sub-containers side-by-side (e.g. Subnets in a VPC)
    if (containerChildren.length > 0) {
      let currentX = PADDING;
      let maxSubContainerHeight = 0;

      for (const subContainer of containerChildren) {
        const styleWidth = Number(subContainer.style?.width) || 240;
        const styleHeight = Number(subContainer.style?.height) || 140;

        subContainer.position = { x: currentX, y: currentY };
        currentX += styleWidth + GAP_X;
        maxSubContainerHeight = Math.max(maxSubContainerHeight, styleHeight);
      }

      maxContainerWidth = Math.max(
        maxContainerWidth,
        currentX - GAP_X + PADDING,
      );
      currentY += maxSubContainerHeight + GAP_Y;
    }

    // B. Arrange remaining leaf nodes in a neat wrapping grid
    if (leafChildren.length > 0) {
      const cols = 2; // Set max columns for compact sizing
      let index = 0;
      let maxRowWidth = 0;

      for (const leaf of leafChildren) {
        const col = index % cols;
        const row = Math.floor(index / cols);

        const lx = PADDING + col * (LEAF_WIDTH + GAP_X);
        const ly = currentY + row * (LEAF_HEIGHT + GAP_Y);

        leaf.position = { x: lx, y: ly };
        maxRowWidth = Math.max(maxRowWidth, lx + LEAF_WIDTH + PADDING);
        index++;
      }

      maxContainerWidth = Math.max(maxContainerWidth, maxRowWidth);
      const rows = Math.ceil(leafChildren.length / cols);
      currentY += rows * (LEAF_HEIGHT + GAP_Y) - GAP_Y + PADDING;
    } else {
      currentY += PADDING;
    }

    // Assign final computed boundary style size to the container node
    container.style = {
      width: maxContainerWidth,
      height: currentY,
    };
  }

  // 2. Lay out top-level elements
  const topLevelNodes = Array.from(nodeMap.values()).filter(
    (n) => !n.parentNode,
  );
  const topLevelContainers = topLevelNodes.filter((n) =>
    isContainerService(n.data.serviceId),
  );
  const topLevelLeafs = topLevelNodes.filter(
    (n) => !isContainerService(n.data.serviceId),
  );

  let nextTopLevelX = 350; // Leave space on the left for ingress (e.g. API Gateway)
  let mainContainersHeight = 400;

  // A. Position top-level containers horizontally side-by-side
  for (const container of topLevelContainers) {
    container.position = { x: nextTopLevelX, y: 150 };
    const styleWidth = Number(container.style?.width) || 300;
    const styleHeight = Number(container.style?.height) || 400;
    nextTopLevelX += styleWidth + 120;
    mainContainersHeight = Math.max(mainContainersHeight, styleHeight);
  }

  // Fallback if there are no containers
  if (topLevelContainers.length === 0) {
    nextTopLevelX = 50;
  }

  // B. Lay out independent leaf nodes symmetrically relative to main containers
  const ingressLeafs = topLevelLeafs.filter((n) =>
    ['api-gateway', 'route53', 'dns'].includes(n.data.serviceId),
  );
  const dataLeafs = topLevelLeafs.filter((n) =>
    ['s3', 'dynamodb', 'ecr', 'kinesis'].includes(n.data.serviceId),
  );
  const authLeafs = topLevelLeafs.filter((n) =>
    ['iam-role', 'security-group'].includes(n.data.serviceId),
  );
  const restLeafs = topLevelLeafs.filter(
    (n) =>
      !ingressLeafs.includes(n) &&
      !dataLeafs.includes(n) &&
      !authLeafs.includes(n),
  );

  // Position ingress on the left
  let currentY = 150;
  for (const node of ingressLeafs) {
    node.position = { x: 50, y: currentY };
    currentY += LEAF_HEIGHT + GAP_Y;
  }

  // Position security/auth at the top
  let currentX = 350;
  for (const node of authLeafs) {
    node.position = { x: currentX, y: 40 };
    currentX += LEAF_WIDTH + GAP_X;
  }

  // Position database/storage on the right
  currentY = 150;
  const rightX = Math.max(800, nextTopLevelX - 60);
  for (const node of dataLeafs) {
    node.position = { x: rightX, y: currentY };
    currentY += LEAF_HEIGHT + GAP_Y;
  }

  // Position rest in a clean grid below the containers
  currentX = 350;
  currentY = 200 + mainContainersHeight;
  let index = 0;
  for (const node of restLeafs) {
    const col = index % 3;
    const row = Math.floor(index / 3);
    node.position = {
      x: currentX + col * (LEAF_WIDTH + GAP_X),
      y: currentY + row * (LEAF_HEIGHT + GAP_Y),
    };
    index++;
  }

  return Array.from(nodeMap.values());
}
