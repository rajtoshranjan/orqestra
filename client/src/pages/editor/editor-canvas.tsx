import React from 'react';
import ReactFlow, {
  addEdge,
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MiniMap,
  MarkerType,
  type Node,
  type NodeDragHandler,
  type NodeMouseHandler,
  type OnConnect,
  type OnConnectEnd,
  type OnConnectStart,
  type OnError,
  type ReactFlowInstance,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useLocalStorage } from 'usehooks-ts';
import {
  Sparkles,
  Grid3x3,
  Lock,
  Unlock,
  Grid,
  Rocket,
  AlertTriangle,
} from 'lucide-react';
import { EditorToolbar } from './editor-toolbar';
import { ServiceCatalog } from './service-catalog';
import { NodeInspector } from './node-inspector';
import { DeployDrawer } from './deploy-drawer';
import { ContextMenu } from './context-menu';
import { QuickAddMenu } from './quick-add-menu';
import { useKeyboardShortcuts } from '@/hooks';
import {
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui';

import type {
  DiagramNode,
  DiagramEdge,
  ServiceNodeData,
  DeploymentSettings,
  PlanSummary,
  PersistedDiagram,
  DeploymentResult,
} from '@/types';
import { DeploymentStatus } from '@/types';
import {
  createServiceNode,
  withValidatedData,
  buildPlan,
  enrichPlanWithDeploymentDiff,
  serializeDiagram,
  createLog,
  hasValidationErrors,
  countNodeErrors,
  cloneSelection,
  pasteSelection,
  makeId,
  GRID,
  NODE_DRAG_TYPE,
  getNodeAbsolutePosition,
  getNodeDimensions,
  getDescendants,
  createServerlessApiTemplate,
  createEventDrivenTemplate,
  createSecureVpcTemplate,
  createMicroservicesTemplate,
  adjustParentSizes,
  findBestParentForPosition,
} from '@/utils';
import { cn } from '@/lib/utils';
import { registry } from '@/services';
import { toast } from '@/hooks/use-toast';
import {
  useUpdateProject,
  useProjectDeploymentState,
  useCreateDeployment,
} from '@/api';
import { useActiveDeploymentResult } from '@/hooks/use-active-deployment-result';
import { useAppDispatch, useAppSelector } from '@/store';
import { autoLayoutDiagram } from '@/utils/auto-layout';

import {
  setNodes as setReduxNodes,
  setEdges as setReduxEdges,
  setLastSavedAt,
  setClipboard,
  setIsLocked,
  setSnapToGrid,
} from '@/store/editor-slice';
import {
  setDeploymentSettings,
  setActiveDeploymentId,
} from '@/store/deployment-slice';
import {
  setDeployDrawerOpen,
  setProjectSettingsOpen,
  setContextMenu,
} from '@/store/ui-slice';

const PRO_OPTIONS = { hideAttribution: true };
const CONTAINER_CHILD_PADDING = 24;
const CONTAINER_HEADER_HEIGHT = 56;

type DeploymentNodeStatus = 'not_deployed' | 'deployed' | 'dirty';

type EnrichedServiceNodeData = ServiceNodeData & {
  deploymentStatus: DeploymentNodeStatus;
  isDragOver: boolean;
  isConnectingActive: boolean;
  isValidTarget: boolean;
  onToggleCollapse: () => void;
};

type DragParentLookupResult = {
  bestParent: DiagramNode | null;
  absoluteDraggedPosition: { x: number; y: number };
  nodesWithDraggedNode: DiagramNode[];
};

const getMiniMapNodeColor = (node: Node<ServiceNodeData>) => {
  const diagNode: DiagramNode = node;
  return countNodeErrors(diagNode) > 0
    ? 'var(--color-warning)'
    : 'var(--color-accent)';
};

const getNodesWithDraggedNode = (
  draggedNode: DiagramNode,
  currentNodes: DiagramNode[],
): DiagramNode[] =>
  currentNodes.map((currentNode) => {
    if (currentNode.id !== draggedNode.id) {
      return currentNode;
    }

    return {
      ...currentNode,
      position: draggedNode.position,
      positionAbsolute: draggedNode.positionAbsolute,
      parentNode: draggedNode.parentNode,
      width: draggedNode.width ?? currentNode.width,
      height: draggedNode.height ?? currentNode.height,
      style: draggedNode.style ?? currentNode.style,
    };
  });

const findBestParentForDraggedNode = (
  draggedNode: DiagramNode,
  currentNodes: DiagramNode[],
): DragParentLookupResult => {
  const nodesWithDraggedNode = getNodesWithDraggedNode(
    draggedNode,
    currentNodes,
  );
  const absoluteDraggedPosition = getNodeAbsolutePosition(
    draggedNode,
    nodesWithDraggedNode,
  );
  const draggedDimensions = getNodeDimensions(draggedNode);
  const center = {
    x: absoluteDraggedPosition.x + draggedDimensions.width / 2,
    y: absoluteDraggedPosition.y + draggedDimensions.height / 2,
  };
  const childService = registry.find(draggedNode.data.serviceId);

  let bestParent: DiagramNode | null = null;

  for (const candidateNode of nodesWithDraggedNode) {
    if (candidateNode.id === draggedNode.id) continue;

    const service = registry.find(candidateNode.data.serviceId);
    if (!service || !service.isContainer) continue;
    if (!childService?.allowedParents?.includes(candidateNode.data.serviceId)) {
      continue;
    }

    const parentPosition = getNodeAbsolutePosition(
      candidateNode,
      nodesWithDraggedNode,
    );
    const parentDimensions = getNodeDimensions(candidateNode);

    const isWithinParent =
      center.x >= parentPosition.x &&
      center.x <= parentPosition.x + parentDimensions.width &&
      center.y >= parentPosition.y &&
      center.y <= parentPosition.y + parentDimensions.height;

    if (!isWithinParent) continue;

    if (!bestParent) {
      bestParent = candidateNode;
      continue;
    }

    const bestParentPosition = getNodeAbsolutePosition(
      bestParent,
      nodesWithDraggedNode,
    );

    if (
      parentPosition.x > bestParentPosition.x ||
      parentPosition.y > bestParentPosition.y
    ) {
      bestParent = candidateNode;
    }
  }

  return { bestParent, absoluteDraggedPosition, nodesWithDraggedNode };
};

const isDiagramStructureEqual = (
  nodesA: DiagramNode[],
  nodesB: DiagramNode[],
  edgesA: DiagramEdge[],
  edgesB: DiagramEdge[],
): boolean => {
  if (nodesA.length !== nodesB.length) return false;
  if (edgesA.length !== edgesB.length) return false;

  // Check nodes structure & configs
  for (let i = 0; i < nodesA.length; i++) {
    const nA = nodesA[i];
    const nB = nodesB.find((n) => n.id === nA.id);
    if (!nB) return false;

    if (nA.parentNode !== nB.parentNode) return false;
    if (nA.position.x !== nB.position.x || nA.position.y !== nB.position.y)
      return false;
    if (nA.width !== nB.width || nA.height !== nB.height) return false;

    // Check config
    if (JSON.stringify(nA.data.config) !== JSON.stringify(nB.data.config))
      return false;
  }

  // Check edges
  for (let i = 0; i < edgesA.length; i++) {
    const eA = edgesA[i];
    const eB = edgesB.find((e) => e.id === eA.id);
    if (!eB) return false;
    if (
      eA.source !== eB.source ||
      eA.target !== eB.target ||
      eA.sourceHandle !== eB.sourceHandle ||
      eA.targetHandle !== eB.targetHandle
    ) {
      return false;
    }
  }

  return true;
};

type CanvasEditorProps = {
  initialProject: PersistedDiagram;
  onNavigateHome: () => void;
};

export function CanvasEditor({
  initialProject,
  onNavigateHome,
}: CanvasEditorProps) {
  const dispatch = useAppDispatch();

  /* Select state from Redux */
  const {
    projectId: currentProjectId,
    projectName,
    projectDescription,
    awsAccountId,
    snapToGrid,
    isLocked,
    clipboard,
  } = useAppSelector((state) => state.editor);

  const { settings: deploymentSettings, activeDeploymentId } = useAppSelector(
    (state) => state.deployment,
  );

  const { deployDrawerOpen, contextMenu, theme } = useAppSelector(
    (state) => state.ui,
  );

  const createDeploymentMutation = useCreateDeployment();
  const { data: projectDeploymentState } =
    useProjectDeploymentState(currentProjectId);

  const [localValidationResult, setLocalValidationResult] =
    React.useState<DeploymentResult | null>(null);

  const [quickAdd, setQuickAdd] = React.useState<{
    x: number;
    y: number;
    flowPosition: { x: number; y: number };
  } | null>(null);

  const [connectingSource, setConnectingSource] = React.useState<string | null>(
    null,
  );
  const [dragOverNodeId, setDragOverNodeId] = React.useState<string | null>(
    null,
  );

  const { deploymentResult: queryDeploymentResult } =
    useActiveDeploymentResult(currentProjectId);

  const deploymentResult = React.useMemo(() => {
    if (activeDeploymentId) {
      return queryDeploymentResult;
    }
    return localValidationResult || queryDeploymentResult;
  }, [activeDeploymentId, queryDeploymentResult, localValidationResult]);

  const [sidebarCollapsed, setSidebarCollapsed] = useLocalStorage(
    'sidebarCollapsed',
    false,
  );

  const [helpOpen, setHelpOpen] = React.useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = React.useState(false);

  /* Build nodeTypes from registry (memoized) */
  const nodeTypes = React.useMemo(() => registry.getNodeTypes(), []);

  /* Local ReactFlow state (maintains smooth 60fps canvas performance) */
  const [nodes, setNodes, onNodesChange] = useNodesState(initialProject.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialProject.edges);

  const nodesRef = React.useRef(nodes);
  const edgesRef = React.useRef(edges);
  const deploymentResultRef = React.useRef(deploymentResult);

  nodesRef.current = nodes;
  edgesRef.current = edges;
  deploymentResultRef.current = deploymentResult;

  // Use projectDeploymentState for indicators — only updated after successful deploys.
  const deployedGraphNodes = projectDeploymentState?.lastDeployment
    ?.graphSnapshot?.nodes as DiagramNode[] | undefined;

  const handleToggleCollapse = React.useCallback(
    (nodeId: string) => {
      setNodes((current) => {
        const targetNode = current.find((n) => n.id === nodeId);
        if (!targetNode) return current;

        const nextCollapsed = !targetNode.data.config.isCollapsed;
        const descendants = getDescendants(nodeId, current);

        return current.map((n) => {
          if (n.id === nodeId) {
            return {
              ...n,
              data: {
                ...n.data,
                config: {
                  ...n.data.config,
                  isCollapsed: nextCollapsed,
                },
              },
            };
          }
          if (descendants.includes(n.id)) {
            return {
              ...n,
              hidden: nextCollapsed,
            };
          }
          return n;
        });
      });
    },
    [setNodes],
  );

  const enrichedNodes = React.useMemo(() => {
    const deployedNodeMap = new Map(
      (deployedGraphNodes ?? []).map((node) => [node.id, node]),
    );

    const sourceNode = connectingSource
      ? nodes.find((n) => n.id === connectingSource)
      : null;
    const sourceService = sourceNode
      ? registry.find(sourceNode.data.serviceId)
      : null;

    const mappedNodes = nodes.map((node) => {
      const lastDeployedNode = deployedNodeMap.get(node.id);

      let deploymentStatus: DeploymentNodeStatus = 'not_deployed';
      if (lastDeployedNode) {
        const currentConfigStr = JSON.stringify(node.data?.config || {});
        const deployedConfigStr = JSON.stringify(
          lastDeployedNode.data?.config || {},
        );
        if (currentConfigStr === deployedConfigStr) {
          deploymentStatus = 'deployed';
        } else {
          deploymentStatus = 'dirty';
        }
      }

      // Target connection validity check
      let isValidTarget = true;
      if (connectingSource) {
        if (node.id === connectingSource) {
          isValidTarget = false;
        } else if (sourceService) {
          const targetServiceId = node.data.serviceId;
          const isForbidden =
            sourceService.forbiddenRelationships?.includes(targetServiceId);
          const isAllowed =
            !sourceService.allowedRelationships ||
            sourceService.allowedRelationships.includes(targetServiceId);
          isValidTarget = !isForbidden && isAllowed;
        }
      }

      const isDragOver = dragOverNodeId === node.id;
      const connectionClass =
        connectingSource && !isValidTarget
          ? 'opacity-30 pointer-events-none'
          : '';

      return {
        ...node,
        className: cn(node.className, connectionClass),
        data: {
          ...node.data,
          deploymentStatus,
          isDragOver,
          isConnectingActive: !!connectingSource,
          isValidTarget,
          onToggleCollapse: () => handleToggleCollapse(node.id),
        },
      };
    });

    // Sort nodes to ensure parents always appear before children in the array
    const nodeMapForSorting = new Map(mappedNodes.map((n) => [n.id, n]));
    const getDepth = (nodeId: string): number => {
      let depth = 0;
      let current = nodeMapForSorting.get(nodeId);
      while (current?.parentNode) {
        depth++;
        current = nodeMapForSorting.get(current.parentNode);
      }
      return depth;
    };

    const depths = new Map<string, number>();
    for (const node of mappedNodes) {
      depths.set(node.id, getDepth(node.id));
    }

    const layeredNodes = mappedNodes.map((node) => {
      const depth = depths.get(node.id) || 0;
      const service = registry.find(node.data.serviceId);
      const isContainer = service?.isContainer || false;
      return {
        ...node,
        zIndex: isContainer ? depth + 1 : 1000,
      };
    });

    return layeredNodes.sort(
      (a, b) => (depths.get(a.id) || 0) - (depths.get(b.id) || 0),
    );
  }, [
    nodes,
    deployedGraphNodes,
    connectingSource,
    dragOverNodeId,
    handleToggleCollapse,
  ]);

  const enrichedEdges = React.useMemo(() => {
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));

    return edges.map((edge) => {
      const sourceNode = nodeMap.get(edge.source);
      const targetNode = nodeMap.get(edge.target);

      if (!sourceNode || !targetNode) return edge;

      const isHidden = !!(sourceNode.hidden || targetNode.hidden);

      const sourceSvc = sourceNode.data?.serviceId;
      const targetSvc = targetNode.data?.serviceId;

      let label = '';
      let animated = false;
      let stroke = '#94a3b8'; // Slate-400 default
      let strokeDasharray = undefined;

      if (targetSvc === 'lambda') {
        const triggers = [
          'api-gateway',
          'sqs',
          'sns',
          'dynamodb',
          's3',
          'eventbridge',
          'kinesis',
        ];
        if (triggers.includes(sourceSvc)) {
          label = 'Triggers';
          animated = true;
          stroke = '#6366f1'; // Indigo-500
        }
      } else if (sourceSvc === 'lambda') {
        if (targetSvc === 'iam-role') {
          label = 'Executes As';
          stroke = '#f59e0b'; // Amber-500
        } else if (targetSvc === 'efs') {
          label = 'Mounts';
          animated = true;
          stroke = '#3b82f6'; // Blue-500
          strokeDasharray = '5,5';
        } else if (targetSvc === 'lambda-layer') {
          label = 'Uses';
          stroke = '#3b82f6'; // Blue-500
        } else if (targetSvc === 'ecr') {
          label = 'Uses Image';
          stroke = '#f59e0b'; // Amber-500
        } else if (['vpc', 'subnet', 'security-group'].includes(targetSvc)) {
          label = 'Hosted In';
          stroke = '#10b981'; // Emerald-500
        } else if (
          ['sqs', 'sns', 'eventbridge', 'lambda'].includes(targetSvc)
        ) {
          label = 'Routes To';
          animated = true;
          stroke = '#8b5cf6'; // Purple-500
        }
      } else if (sourceSvc === 'subnet' && targetSvc === 'vpc') {
        label = 'Subnet Of';
        stroke = '#10b981';
      } else if (sourceSvc === 'security-group' && targetSvc === 'vpc') {
        label = 'Rules In';
        stroke = '#10b981';
      }

      return {
        ...edge,
        label,
        animated,
        hidden: isHidden,
        zIndex: 500,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 18,
          height: 18,
          color: stroke,
        },
        style: {
          stroke,
          strokeWidth: 2,
          strokeDasharray,
        },
        labelStyle: {
          fill: '#94a3b8',
          fontSize: '7.5px',
          fontWeight: 'bold',
        },
        labelBgStyle: {
          fill: 'var(--color-bg-base)',
          fillOpacity: 0.85,
          rx: 4,
          ry: 4,
        },
      };
    });
  }, [edges, nodes]);

  const [planSummary, setPlanSummary] = React.useState<PlanSummary>(() =>
    buildPlan(initialProject.nodes, initialProject.edges),
  );

  const enrichedPlanSummary = React.useMemo(() => {
    const diffPlan = enrichPlanWithDeploymentDiff(
      planSummary,
      deployedGraphNodes ?? null,
      enrichedNodes,
    );

    const enrichedNodesMap = new Map(
      enrichedNodes.map((node) => [node.id, node]),
    );

    return {
      ...diffPlan,
      resources: diffPlan.resources.map((resource) => {
        const enrichedNode = enrichedNodesMap.get(resource.id);
        return {
          ...resource,
          deploymentStatus:
            (enrichedNode?.data as EnrichedServiceNodeData | undefined)
              ?.deploymentStatus ?? 'not_deployed',
        };
      }),
    };
  }, [planSummary, enrichedNodes, deployedGraphNodes]);
  const [reactFlowInstance, setReactFlowInstance] =
    React.useState<ReactFlowInstance<ServiceNodeData> | null>(null);

  // Capture initial mount state to prevent autosave loop from refetches.
  const originalProjectRef = React.useRef({
    nodes: initialProject.nodes,
    edges: initialProject.edges,
    deploymentSettings: initialProject.deploymentSettings,
    projectName: initialProject.projectName,
    projectDescription: initialProject.projectDescription,
    awsAccountId: initialProject.awsAccountId,
  });

  const mouseRef = React.useRef({
    clientX: window.innerWidth / 2,
    clientY: window.innerHeight / 2,
  });
  React.useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      mouseRef.current = { clientX: event.clientX, clientY: event.clientY };
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  /* Sync nodes and edges into Redux for query/deploy selections. */
  React.useEffect(() => {
    dispatch(setReduxNodes(nodes));
  }, [nodes, dispatch]);

  React.useEffect(() => {
    dispatch(setReduxEdges(edges));
  }, [edges, dispatch]);

  /* Run validation automatically whenever nodes (configurations) or edges change. */
  React.useEffect(() => {
    if (nodes.length === 0) return;

    let hasChanges = false;
    const nextNodes = nodes.map((node) => {
      const nextNode = withValidatedData(node, nodes, edges);
      if (
        JSON.stringify(node.data.validationErrors || {}) !==
        JSON.stringify(nextNode.data.validationErrors || {})
      ) {
        hasChanges = true;
      }
      return nextNode;
    });

    if (hasChanges) {
      setNodes(nextNodes);
    }
  }, [edges, nodes, setNodes]);

  /* Automatically clean up any redundant edges (direct connections between parent container and descendants). */
  React.useEffect(() => {
    if (nodes.length === 0 || edges.length === 0) {
      return;
    }

    const isAncestor = (ancestorId: string, descendantId: string): boolean => {
      let current = nodes.find((n) => n.id === descendantId);
      while (current && current.parentNode) {
        if (current.parentNode === ancestorId) {
          return true;
        }
        current = nodes.find((n) => n.id === current!.parentNode);
      }
      return false;
    };

    const nextEdges = edges.filter(
      (edge) =>
        !isAncestor(edge.source, edge.target) &&
        !isAncestor(edge.target, edge.source),
    );

    if (nextEdges.length !== edges.length) {
      setEdges(nextEdges);
    }
  }, [nodes, edges, setEdges]);

  /* Derived */
  const selectedNodes = nodes.filter((node) => node.selected);
  const selectedNode = selectedNodes.length === 1 ? selectedNodes[0] : null;

  /* Persist Diagram */
  const updateProjectMutation = useUpdateProject();

  const persistDiagram = React.useCallback(
    async (
      nextProjectId: string,
      nextProjectName: string,
      nextProjectDescription: string,
      nextAwsAccountId: string | null,
      nextNodes: DiagramNode[],
      nextEdges: DiagramEdge[],
      nextSettings: DeploymentSettings,
      silent = false,
    ) => {
      const timestamp = new Date().toISOString();
      const payload = serializeDiagram({
        projectId: nextProjectId,
        projectName: nextProjectName,
        projectDescription: nextProjectDescription,
        awsAccountId: nextAwsAccountId,
        nodes: nextNodes,
        edges: nextEdges,
        deploymentSettings: nextSettings,
        lastSavedAt: timestamp,
      });

      try {
        await updateProjectMutation.mutateAsync({
          projectId: nextProjectId,
          data: payload,
        });
        dispatch(setLastSavedAt(timestamp));

        // Update the ref so the autosave effect recognizes this as the new base
        originalProjectRef.current = {
          nodes: nextNodes,
          edges: nextEdges,
          deploymentSettings: nextSettings,
          projectName: nextProjectName,
          projectDescription: nextProjectDescription,
          awsAccountId: nextAwsAccountId,
        };

        if (!silent) {
          toast({
            title: 'Project saved',
            description:
              'The current architecture project has been saved to the server.',
          });
        }
      } catch (err) {
        console.error('Failed to save project:', err);
        if (!silent) {
          toast({
            title: 'Error saving project',
            description: 'Could not persist changes to the server.',
            variant: 'destructive',
          });
        }
      }
    },
    [dispatch, updateProjectMutation],
  );

  /* Autosave Effect. */
  React.useEffect(() => {
    // Skip autosave if nothing changed structurally from initial loaded state.
    if (
      isDiagramStructureEqual(
        nodes,
        originalProjectRef.current.nodes,
        edges,
        originalProjectRef.current.edges,
      ) &&
      deploymentSettings === originalProjectRef.current.deploymentSettings &&
      projectName === originalProjectRef.current.projectName &&
      projectDescription === originalProjectRef.current.projectDescription &&
      awsAccountId === originalProjectRef.current.awsAccountId
    ) {
      return;
    }

    const timer = setTimeout(() => {
      void persistDiagram(
        currentProjectId,
        projectName,
        projectDescription,
        awsAccountId,
        nodes,
        edges,
        deploymentSettings,
        true,
      );
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    nodes,
    edges,
    deploymentSettings,
    projectName,
    projectDescription,
    awsAccountId,
    currentProjectId,
    persistDiagram,
  ]);

  /* Update helpers */
  const updateNodesWithValidation = React.useCallback(
    (updater: (current: DiagramNode[]) => DiagramNode[]) => {
      setNodes((current) => {
        const next = updater(current);
        return next.map((node) => withValidatedData(node, next, edges));
      });
    },
    [setNodes, edges],
  );

  const updateSelectedNode = React.useCallback(
    (updater: (config: Record<string, unknown>) => Record<string, unknown>) => {
      if (!selectedNode) return;

      updateNodesWithValidation((current) =>
        current.map((node) => {
          if (node.id !== selectedNode.id) return node;
          const nextConfig = updater(node.data.config);
          const service = registry.find(node.data.serviceId);
          return {
            ...node,
            data: {
              ...node.data,
              config: nextConfig,
              label: service
                ? service.getDisplayName(nextConfig)
                : node.data.label,
            },
          };
        }),
      );
    },
    [selectedNode, updateNodesWithValidation],
  );

  /* Save */
  const saveCurrentDiagram = React.useCallback(() => {
    persistDiagram(
      currentProjectId,
      projectName,
      projectDescription,
      awsAccountId,
      nodes,
      edges,
      deploymentSettings,
    );
  }, [
    awsAccountId,
    currentProjectId,
    deploymentSettings,
    edges,
    nodes,
    persistDiagram,
    projectDescription,
    projectName,
  ]);

  const onNodeDrag = React.useCallback<NodeDragHandler>((_event, node) => {
    const draggedNode = node as DiagramNode;
    const { bestParent } = findBestParentForDraggedNode(
      draggedNode,
      nodesRef.current,
    );
    const nextDragOverNodeId = bestParent?.id ?? null;

    setDragOverNodeId((currentDragOverNodeId) =>
      currentDragOverNodeId === nextDragOverNodeId
        ? currentDragOverNodeId
        : nextDragOverNodeId,
    );
  }, []);

  const onNodeDragStop = React.useCallback<NodeDragHandler>(
    (_event, node) => {
      const draggedNode = node as DiagramNode;
      const { bestParent, absoluteDraggedPosition, nodesWithDraggedNode } =
        findBestParentForDraggedNode(draggedNode, nodesRef.current);

      setDragOverNodeId(null);

      if (bestParent) {
        const parentPosition = getNodeAbsolutePosition(
          bestParent,
          nodesWithDraggedNode,
        );
        const relativeX = Math.max(
          absoluteDraggedPosition.x - parentPosition.x,
          CONTAINER_CHILD_PADDING,
        );
        const relativeY = Math.max(
          absoluteDraggedPosition.y - parentPosition.y,
          CONTAINER_HEADER_HEIGHT + CONTAINER_CHILD_PADDING,
        );

        setNodes((previousNodes) => {
          const nextNodes = previousNodes.map((previousNode) => {
            if (previousNode.id !== draggedNode.id) {
              return previousNode;
            }

            return {
              ...previousNode,
              parentNode: bestParent.id,
              position: { x: relativeX, y: relativeY },
              data: {
                ...previousNode.data,
                config: {
                  ...previousNode.data.config,
                  parentId: bestParent.id,
                },
              },
            };
          });

          return adjustParentSizes(nextNodes);
        });
        return;
      }

      if (!draggedNode.parentNode) return;

      setNodes((previousNodes) =>
        previousNodes.map((previousNode) => {
          if (previousNode.id !== draggedNode.id) {
            return previousNode;
          }

          return {
            ...previousNode,
            parentNode: undefined,
            position: absoluteDraggedPosition,
            data: {
              ...previousNode.data,
              config: {
                ...previousNode.data.config,
                parentId: undefined,
              },
            },
          };
        }),
      );
    },
    [setNodes],
  );

  const onConnectStart = React.useCallback<OnConnectStart>((_event, params) => {
    if (params.nodeId) {
      setConnectingSource(params.nodeId);
    }
  }, []);

  const onConnectEnd = React.useCallback<OnConnectEnd>(() => {
    setConnectingSource(null);
  }, []);

  /* Validate & Plan */
  const validateAndPlan = React.useCallback(() => {
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    const nextNodes = currentNodes.map((node) =>
      withValidatedData(node, currentNodes, currentEdges),
    );
    const nextPlan = buildPlan(nextNodes, currentEdges);

    setNodes(nextNodes);
    setPlanSummary(nextPlan);

    dispatch(setActiveDeploymentId(null));

    if (nextPlan.resourceCount === 0) {
      setLocalValidationResult({
        status: DeploymentStatus.Failed,
        lastRunAt: new Date().toISOString(),
        logs: [
          createLog(
            'error',
            'Add at least one resource node before planning or deploying.',
          ),
        ],
      });
      return { valid: false, plan: nextPlan, nodes: nextNodes };
    }

    if (
      nextNodes.some((node) => hasValidationErrors(node.data.validationErrors))
    ) {
      setLocalValidationResult({
        status: DeploymentStatus.Failed,
        lastRunAt: new Date().toISOString(),
        logs: [
          createLog(
            'error',
            'Some resources still have invalid configuration fields. Fix the highlighted errors and try again.',
          ),
        ],
      });
      return { valid: false, plan: nextPlan, nodes: nextNodes };
    }

    setLocalValidationResult({
      status: DeploymentStatus.Idle,
      lastRunAt: new Date().toISOString(),
      logs: [
        createLog(
          'info',
          `Plan ready: ${nextPlan.resourceCount} cloud resource${nextPlan.resourceCount === 1 ? '' : 's'} prepared for deployment.`,
        ),
      ],
    });

    return { valid: true, plan: nextPlan, nodes: nextNodes };
  }, [setNodes, dispatch]);

  /* Add Node (generic — works for any service). */
  const handleAddNode = React.useCallback(
    (serviceId: string) => {
      if (isLocked) return;
      updateNodesWithValidation((current) => [
        ...current.map((node) => ({ ...node, selected: false })),
        createServiceNode(
          serviceId,
          { x: 140 + current.length * 36, y: 160 + current.length * 24 },
          current.length + 1,
        ),
      ]);
    },
    [updateNodesWithValidation, isLocked],
  );

  const handlePaneDoubleClick = React.useCallback(
    (event: React.MouseEvent) => {
      if (isLocked) return;

      const target = event.target as HTMLElement;
      const isInteractiveElement =
        target.closest('.react-flow__node') ||
        target.closest('aside') ||
        target.closest('header') ||
        target.closest('button') ||
        target.closest('input');

      if (isInteractiveElement) return;

      event.preventDefault();
      if (!reactFlowInstance) return;

      const flowPosition = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      setQuickAdd({
        x: event.clientX,
        y: event.clientY,
        flowPosition,
      });
    },
    [reactFlowInstance, isLocked],
  );

  const handleQuickAddNode = React.useCallback(
    (serviceId: string) => {
      if (isLocked || !quickAdd) return;
      updateNodesWithValidation((current) => [
        ...current.map((node) => ({ ...node, selected: false })),
        createServiceNode(serviceId, quickAdd.flowPosition, current.length + 1),
      ]);
      setQuickAdd(null);
    },
    [updateNodesWithValidation, quickAdd, isLocked],
  );

  /* Clipboard Operations */
  const handleCopySelection = React.useCallback(() => {
    const selection = cloneSelection(nodes, edges);
    if (!selection) {
      toast({
        title: 'Nothing selected',
        description: 'Select one or more nodes before copying.',
      });
      return;
    }
    dispatch(setClipboard(selection));
    toast({
      title: 'Copied to clipboard',
      description: `${selection.nodes.length} node${selection.nodes.length === 1 ? '' : 's'} ready to paste.`,
    });
  }, [edges, nodes, dispatch]);

  const handlePasteSelection = React.useCallback(() => {
    if (isLocked) return;
    if (!clipboard) {
      toast({
        title: 'Clipboard is empty',
        description: 'Copy a selection first to paste it into the canvas.',
      });
      return;
    }
    pasteSelection(clipboard, setNodes, setEdges);
  }, [clipboard, setEdges, setNodes, isLocked]);

  const deleteSelection = React.useCallback(() => {
    if (isLocked) return;
    const selectedNodeIds = new Set(
      nodes.filter((node) => node.selected).map((node) => node.id),
    );
    const selectedEdgeIds = new Set(
      edges.filter((edge) => edge.selected).map((edge) => edge.id),
    );
    if (selectedNodeIds.size === 0 && selectedEdgeIds.size === 0) return;

    setNodes((current) =>
      current.filter((node) => !selectedNodeIds.has(node.id)),
    );
    setEdges((current) =>
      current.filter(
        (edge) =>
          !selectedEdgeIds.has(edge.id) &&
          !selectedNodeIds.has(edge.source) &&
          !selectedNodeIds.has(edge.target),
      ),
    );
    dispatch(setContextMenu(null));
  }, [edges, nodes, setEdges, setNodes, dispatch, isLocked]);

  /* Duplicate */
  const handleDuplicateNode = React.useCallback(
    (nodeId: string) => {
      if (isLocked) return;
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;

      setNodes((current) => [
        ...current.map((n) => ({ ...n, selected: false })),
        {
          ...withValidatedData(
            {
              ...node,
              id: makeId(),
              position: { x: node.position.x + 56, y: node.position.y + 56 },
              selected: true,
            },
            current,
            edges,
          ),
        },
      ]);
      dispatch(setContextMenu(null));
    },
    [nodes, edges, setNodes, dispatch, isLocked],
  );

  /* Deploy */
  const handleDeploy = React.useCallback(async () => {
    if (!awsAccountId) {
      toast({
        title: 'AWS account required',
        description:
          'Select an AWS account in Project Settings before deploying.',
        variant: 'destructive',
      });
      dispatch(setProjectSettingsOpen(true));
      return;
    }

    const { valid, nodes: validatedNodes } = validateAndPlan();

    if (!valid) {
      toast({
        title: 'Deployment blocked',
        description: 'Finish the required resource fields before deploying.',
        variant: 'destructive',
      });
      return;
    }

    // Save diagram first so backend has latest config
    await persistDiagram(
      currentProjectId,
      projectName,
      projectDescription,
      awsAccountId,
      validatedNodes,
      edges,
      deploymentSettings,
      true,
    );

    try {
      const deployment =
        await createDeploymentMutation.mutateAsync(currentProjectId);
      setLocalValidationResult(null);
      dispatch(setActiveDeploymentId(deployment.id));
      toast({
        title: 'Deployment started',
        description:
          'The deployment process has been initiated asynchronously.',
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'The deployment service could not be reached.';

      setLocalValidationResult({
        status: DeploymentStatus.Failed,
        lastRunAt: new Date().toISOString(),
        logs: [createLog('error', message)],
      });

      toast({
        title: 'Deployment failed',
        description: message,
        variant: 'destructive',
      });
    }
  }, [
    awsAccountId,
    currentProjectId,
    projectName,
    projectDescription,
    edges,
    deploymentSettings,
    validateAndPlan,
    persistDiagram,
    createDeploymentMutation,
    dispatch,
  ]);

  const handleTriggerAutoLayout = React.useCallback(() => {
    updateNodesWithValidation((current) => {
      return autoLayoutDiagram(current, edgesRef.current);
    });
    toast({
      title: 'Auto Layout Applied',
      description: 'Arranged nodes into clean grids and containers.',
    });
  }, [updateNodesWithValidation]);

  const handlePlan = React.useCallback(() => {
    const isDeploying =
      deploymentResultRef.current.status === DeploymentStatus.Pending ||
      deploymentResultRef.current.status === DeploymentStatus.InProgress;

    if (!isDeploying) {
      validateAndPlan();
    }
    dispatch(setDeployDrawerOpen(true));
  }, [validateAndPlan, dispatch]);

  const handleApplyStarter = React.useCallback(
    (starter: { nodes: DiagramNode[]; edges: DiagramEdge[] }) => {
      updateNodesWithValidation(() => {
        return autoLayoutDiagram(starter.nodes, starter.edges);
      });
      setEdges(starter.edges);
      toast({
        title: 'Starter Template Applied',
        description:
          'Arranged template resources into clean grids and boundaries.',
      });
    },
    [updateNodesWithValidation, setEdges],
  );

  const handleSelectNode = React.useCallback(
    (nodeId: string) => {
      setNodes((prevNodes) =>
        prevNodes.map((node) => ({
          ...node,
          selected: node.id === nodeId,
        })),
      );
      const targetNode = nodesRef.current.find((node) => node.id === nodeId);
      if (targetNode && reactFlowInstance) {
        reactFlowInstance.fitView({
          nodes: [targetNode],
          duration: 400,
          maxZoom: 1.2,
        });
      }
    },
    [setNodes, reactFlowInstance],
  );

  const handleClearCanvas = React.useCallback(() => {
    if (isLocked) return;
    setClearConfirmOpen(true);
  }, [isLocked]);

  const confirmClearCanvas = React.useCallback(() => {
    setNodes([]);
    setEdges([]);
    toast({
      title: 'Canvas Cleared',
      description: 'All nodes and connections have been removed.',
    });
    setClearConfirmOpen(false);
  }, [setNodes, setEdges]);

  /* Centralized Keyboard Shortcuts definition list. */
  const shortcuts = React.useMemo(() => {
    return [
      {
        key: '/',
        description: 'Open Quick Add catalog menu at cursor',
        category: 'canvas' as const,
        handler: () => {
          const clientX = mouseRef.current.clientX;
          const clientY = mouseRef.current.clientY;
          const flowPosition = reactFlowInstance?.screenToFlowPosition({
            x: clientX,
            y: clientY,
          }) || { x: 0, y: 0 };
          setQuickAdd({ x: clientX, y: clientY, flowPosition });
        },
        disabled: isLocked,
      },
      {
        key: 'l',
        alt: true,
        description: 'Auto layout resources into clean columns and containers',
        category: 'canvas' as const,
        handler: handleTriggerAutoLayout,
      },
      {
        key: 'l',
        alt: true,
        shift: true,
        description: 'Toggle canvas edit lock (Lock/Unlock drawing & moving)',
        category: 'canvas' as const,
        handler: () => {
          dispatch(setIsLocked(!isLocked));
          toast({
            title: !isLocked ? 'Editor Locked' : 'Editor Unlocked',
            description: !isLocked
              ? 'Resource configurations and positions are frozen.'
              : 'You can now configure and move resources.',
            icon: !isLocked ? (
              <Lock className="size-4 text-violet-500" />
            ) : (
              <Unlock className="size-4 text-emerald-500" />
            ),
          });
        },
      },
      {
        key: 'g',
        alt: true,
        description: 'Toggle snapping elements to the canvas layout grid',
        category: 'canvas' as const,
        handler: () => {
          dispatch(setSnapToGrid(!snapToGrid));
          toast({
            title: 'Grid Snapping',
            description: !snapToGrid
              ? 'Elements will now align to the grid.'
              : 'Free dragging enabled.',
            icon: <Grid className="size-4 text-blue-500" />,
          });
        },
      },
      {
        key: 'd',
        alt: true,
        description: 'Open the Plan & Deploy workspace panel',
        category: 'general' as const,
        handler: handlePlan,
      },
      {
        key: 's',
        meta: true,
        description: 'Manually save current architecture state to the cloud',
        category: 'general' as const,
        handler: saveCurrentDiagram,
      },
      {
        key: 'a',
        meta: true,
        description: 'Select all resource nodes on the canvas',
        category: 'edit' as const,
        handler: () => {
          setNodes((prevNodes) =>
            prevNodes.map((node) => ({ ...node, selected: true })),
          );
        },
        disabled: isLocked,
      },
      {
        key: 'c',
        meta: true,
        description: 'Copy selected resources to the clipboard',
        category: 'edit' as const,
        handler: handleCopySelection,
      },
      {
        key: 'v',
        meta: true,
        description: 'Paste copied resources onto the canvas',
        category: 'edit' as const,
        handler: handlePasteSelection,
        disabled: isLocked,
      },
      {
        key: '1',
        description: 'Zoom to fit entire architecture in the view',
        category: 'view' as const,
        handler: () => {
          reactFlowInstance?.fitView({ duration: 400 });
        },
      },
      {
        key: '2',
        description: 'Zoom to fit currently selected resources',
        category: 'view' as const,
        handler: () => {
          const selected = nodesRef.current.filter((node) => node.selected);
          if (selected.length > 0) {
            reactFlowInstance?.fitView({ nodes: selected, duration: 400 });
          } else {
            toast({
              title: 'No selection',
              description: 'Select at least one node to zoom to selection.',
            });
          }
        },
      },
      {
        key: 'Delete',
        description: 'Delete selected resources and connections',
        category: 'edit' as const,
        handler: deleteSelection,
        disabled: isLocked,
      },
      {
        key: 'Backspace',
        description: 'Delete selected resources and connections',
        category: 'edit' as const,
        handler: deleteSelection,
        disabled: isLocked,
      },
      {
        key: 'Escape',
        description: 'Cancel active action, clear selection or close menus',
        category: 'general' as const,
        handler: () => {
          setQuickAdd(null);
          setNodes((prevNodes) =>
            prevNodes.map((node) => ({ ...node, selected: false })),
          );
        },
      },
      {
        key: '?',
        description: 'Open the Keyboard Shortcuts helper panel',
        category: 'general' as const,
        handler: () => {
          setHelpOpen(true);
        },
      },
    ];
  }, [
    isLocked,
    snapToGrid,
    reactFlowInstance,
    handleTriggerAutoLayout,
    handlePlan,
    saveCurrentDiagram,
    handleCopySelection,
    handlePasteSelection,
    deleteSelection,
    dispatch,
    setNodes,
  ]);

  useKeyboardShortcuts(shortcuts, [shortcuts]);

  /* Context menu click-away */
  React.useEffect(() => {
    const handleClickAway = () => dispatch(setContextMenu(null));
    window.addEventListener('click', handleClickAway);
    return () => window.removeEventListener('click', handleClickAway);
  }, [dispatch]);

  /* Drop handler for ServiceCatalog drag. */
  const handleDrop = React.useCallback(
    (event: React.DragEvent) => {
      if (isLocked) return;
      event.preventDefault();
      const serviceId = event.dataTransfer.getData(NODE_DRAG_TYPE);
      if (!serviceId || !reactFlowInstance) return;

      // Verify service exists in registry.
      if (!registry.find(serviceId)) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      updateNodesWithValidation((current) => {
        const bestParent = findBestParentForPosition(
          position,
          serviceId,
          current,
        );
        let newNode: any;

        if (bestParent) {
          const parentPos = getNodeAbsolutePosition(bestParent, current);
          let relativeX = position.x - parentPos.x;
          let relativeY = position.y - parentPos.y;

          const PADDING = 24;
          const HEADER_HEIGHT = 56;
          if (relativeX < PADDING) relativeX = PADDING;
          if (relativeY < HEADER_HEIGHT + PADDING)
            relativeY = HEADER_HEIGHT + PADDING;

          newNode = createServiceNode(
            serviceId,
            { x: relativeX, y: relativeY },
            current.length + 1,
          );
          newNode.parentNode = bestParent.id;
          newNode.data.config.parentId = bestParent.id;
        } else {
          newNode = createServiceNode(serviceId, position, current.length + 1);
        }

        const next = [
          ...current.map((node) => ({ ...node, selected: false })),
          { ...newNode, selected: true },
        ];
        return adjustParentSizes(next);
      });
    },
    [reactFlowInstance, updateNodesWithValidation, isLocked],
  );

  const handleDragOver = React.useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleConnect = React.useCallback<OnConnect>(
    (connection) => {
      if (!connection.source || !connection.target) {
        return;
      }
      const currentNodes = nodesRef.current;
      const sourceNode = currentNodes.find(
        (node) => node.id === connection.source,
      );
      const targetNode = currentNodes.find(
        (node) => node.id === connection.target,
      );

      // Helper function to check if node A is an ancestor of node B.
      const isAncestor = (
        ancestorId: string,
        descendantId: string,
      ): boolean => {
        let current = currentNodes.find((n) => n.id === descendantId);
        while (current && current.parentNode) {
          if (current.parentNode === ancestorId) {
            return true;
          }
          current = currentNodes.find((n) => n.id === current!.parentNode);
        }
        return false;
      };

      if (
        isAncestor(connection.source, connection.target) ||
        isAncestor(connection.target, connection.source)
      ) {
        toast({
          title: 'Redundant Connection',
          description:
            'Nesting already defines containment. A direct arrow connection between container and nested resource is unnecessary.',
          variant: 'default',
          icon: <AlertTriangle className="size-4 text-amber-500" />,
        });
        return;
      }

      if (
        sourceNode?.data.serviceId === 'lambda' &&
        targetNode?.data.serviceId === 'lambda'
      ) {
        toast({
          title: 'Invalid Relationship',
          description:
            'AWS Lambda functions cannot be directly connected at the infrastructure level. Consider: EventBridge, Step Functions, SNS, SQS instead.',
          variant: 'destructive',
        });
        return;
      }

      if (sourceNode) {
        const sourceService = registry.find(sourceNode.data.serviceId);
        if (sourceService) {
          const targetServiceId = targetNode?.data.serviceId || '';
          const isForbidden =
            sourceService.forbiddenRelationships?.includes(targetServiceId);
          const isAllowed =
            !sourceService.allowedRelationships ||
            sourceService.allowedRelationships.includes(targetServiceId);

          if (isForbidden || !isAllowed) {
            toast({
              title: 'Invalid Relationship',
              description: `Connections from ${sourceService.shortName} to ${targetNode?.data.label || 'target'} are not allowed at the infrastructure level.`,
              variant: 'destructive',
            });
            return;
          }
        }
      }

      setEdges((current) =>
        addEdge(
          {
            ...connection,
            animated: false,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 18,
              height: 18,
              color: '#3b82f6',
            },
            style: { stroke: '#3b82f6', strokeWidth: 2 },
            type: 'smoothstep',
          },
          current,
        ),
      );
    },
    [setEdges],
  );

  const handleNodeContextMenu = React.useCallback<NodeMouseHandler>(
    (event, node) => {
      event.preventDefault();
      if (isLocked) return;

      dispatch(
        setContextMenu({
          nodeId: node.id,
          x: event.clientX,
          y: event.clientY,
        }),
      );
    },
    [dispatch, isLocked],
  );

  const handlePaneClick = React.useCallback(() => {
    dispatch(setContextMenu(null));
    setQuickAdd(null);
  }, [dispatch]);

  const handleReactFlowError = React.useCallback<OnError>((id, message) => {
    if (id === '008') return;
    console.warn(`[React Flow Warning] ${id}: ${message}`);
  }, []);

  const handleToggleSidebarCollapse = React.useCallback(() => {
    setSidebarCollapsed((currentSidebarCollapsed) => !currentSidebarCollapsed);
  }, [setSidebarCollapsed]);

  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden"
      style={{ background: 'var(--color-bg-base)' }}
    >
      {/* Toolbar */}
      <EditorToolbar
        onBack={onNavigateHome}
        onPlan={handlePlan}
        onAutoLayout={handleTriggerAutoLayout}
        isSaving={updateProjectMutation.isPending}
        deploymentStatus={deploymentResult.status}
        onSelectNode={handleSelectNode}
        onHelp={() => setHelpOpen(true)}
        onClearCanvas={handleClearCanvas}
      />

      {/* Main Editor Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Service Catalog */}
        <ServiceCatalog
          collapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleSidebarCollapse}
          onAddNode={handleAddNode}
        />

        {/* ReactFlow Canvas */}
        <div
          className="relative flex-1"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <ReactFlow
            connectionMode={ConnectionMode.Loose}
            deleteKeyCode={null}
            fitView
            minZoom={0.3}
            zoomOnDoubleClick={false}
            nodeTypes={nodeTypes}
            snapGrid={GRID}
            snapToGrid={snapToGrid}
            nodesDraggable={!isLocked}
            nodesConnectable={!isLocked}
            elementsSelectable={!isLocked}
            nodes={enrichedNodes}
            edges={enrichedEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onError={handleReactFlowError}
            onInit={setReactFlowInstance}
            onNodeDrag={onNodeDrag}
            onNodeDragStop={onNodeDragStop}
            onConnectStart={onConnectStart}
            onConnectEnd={onConnectEnd}
            onConnect={handleConnect}
            onNodeContextMenu={handleNodeContextMenu}
            onPaneClick={handlePaneClick}
            onDoubleClick={handlePaneDoubleClick}
            proOptions={PRO_OPTIONS}
          >
            {snapToGrid && (
              <Background
                variant={BackgroundVariant.Dots}
                color={
                  theme === 'light'
                    ? 'rgba(0, 0, 0, 0.15)'
                    : 'rgba(255, 255, 255, 0.15)'
                }
                gap={GRID[0]}
                size={1.1}
              />
            )}
            <Controls position="bottom-right" showInteractive={false} />
            <MiniMap
              className="!bottom-4 !left-4 !h-28 !w-44 overflow-hidden"
              nodeColor={getMiniMapNodeColor}
              pannable
              zoomable
            />
          </ReactFlow>

          {/* Empty Canvas Overlay */}
          {(() => {
            if (nodes.length !== 0) return null;

            const lambdaSvc = registry.find('lambda');
            const s3Svc = registry.find('s3');
            const vpcSvc = registry.find('vpc');
            const sfSvc = registry.find('step-function');

            const LambdaIcon = lambdaSvc?.icon || Sparkles;
            const S3Icon = s3Svc?.icon || Grid3x3;
            const VpcIcon = vpcSvc?.icon || Lock;
            const SfIcon = sfSvc?.icon || Rocket;

            const lambdaColor = lambdaSvc?.accentColor || '#3b82f6';
            const s3Color = s3Svc?.accentColor || '#f59e0b';
            const vpcColor = vpcSvc?.accentColor || '#10b981';
            const sfColor = sfSvc?.accentColor || '#8b5cf6';

            return (
              <div className="pointer-events-none absolute inset-0 z-10 flex select-none flex-col items-center justify-center bg-background/30 p-8 backdrop-blur-[2px]">
                <div className="pointer-events-auto flex w-full max-w-5xl select-text flex-col items-center text-center">
                  <div className="mb-8 text-center">
                    <h1 className="bg-gradient-to-r from-primary to-accent bg-clip-text text-3xl font-extrabold tracking-tight text-foreground">
                      Design Your Cloud Infrastructure
                    </h1>
                    <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
                      Choose a production-grade starter template below to begin
                      designing your architecture.
                    </p>
                  </div>

                  {/* Starters Grid */}
                  <div className="mt-12 grid w-full max-w-5xl grid-cols-1 gap-4 text-left sm:grid-cols-2 lg:grid-cols-4">
                    <div
                      onClick={() =>
                        handleApplyStarter(createServerlessApiTemplate())
                      }
                      className="group relative flex cursor-pointer flex-col items-start rounded-2xl border border-border bg-card/60 p-5 shadow-sm transition-all duration-300 hover:border-primary/50 hover:bg-accent/10"
                    >
                      <div
                        className="mb-4 flex size-10 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
                        style={{
                          backgroundColor: `${lambdaColor}18`,
                          color: lambdaColor,
                        }}
                      >
                        <LambdaIcon size={20} />
                      </div>
                      <h3 className="text-sm font-bold text-foreground transition-colors group-hover:text-primary">
                        Serverless REST API
                      </h3>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground/80">
                        API Gateway, Lambda, and DynamoDB for serverless
                        workloads.
                      </p>
                    </div>

                    <div
                      onClick={() =>
                        handleApplyStarter(createEventDrivenTemplate())
                      }
                      className="group relative flex cursor-pointer flex-col items-start rounded-2xl border border-border bg-card/60 p-5 shadow-sm transition-all duration-300 hover:border-primary/50 hover:bg-accent/10"
                    >
                      <div
                        className="mb-4 flex size-10 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
                        style={{
                          backgroundColor: `${s3Color}18`,
                          color: s3Color,
                        }}
                      >
                        <S3Icon size={20} />
                      </div>
                      <h3 className="text-sm font-bold text-foreground transition-colors group-hover:text-primary">
                        Event-Driven Processor
                      </h3>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground/80">
                        Asynchronous processing using S3 events, SNS topics, and
                        SQS queues.
                      </p>
                    </div>

                    <div
                      onClick={() =>
                        handleApplyStarter(createSecureVpcTemplate())
                      }
                      className="group relative flex cursor-pointer flex-col items-start rounded-2xl border border-border bg-card/60 p-5 shadow-sm transition-all duration-300 hover:border-primary/50 hover:bg-accent/10"
                    >
                      <div
                        className="mb-4 flex size-10 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
                        style={{
                          backgroundColor: `${vpcColor}18`,
                          color: vpcColor,
                        }}
                      >
                        <VpcIcon size={20} />
                      </div>
                      <h3 className="text-sm font-bold text-foreground transition-colors group-hover:text-primary">
                        Secure VPC Network
                      </h3>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground/80">
                        Standard multi-tier layout with Public and Private
                        Subnets in a VPC.
                      </p>
                    </div>

                    <div
                      onClick={() =>
                        handleApplyStarter(createMicroservicesTemplate())
                      }
                      className="group relative flex cursor-pointer flex-col items-start rounded-2xl border border-border bg-card/60 p-5 shadow-sm transition-all duration-300 hover:border-primary/50 hover:bg-accent/10"
                    >
                      <div
                        className="mb-4 flex size-10 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
                        style={{
                          backgroundColor: `${sfColor}18`,
                          color: sfColor,
                        }}
                      >
                        <SfIcon size={20} />
                      </div>
                      <h3 className="text-sm font-bold text-foreground transition-colors group-hover:text-primary">
                        Microservices Pipeline
                      </h3>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground/80">
                        API Proxy routing to private Lambda workers orchestrated
                        via Step Functions.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Context Menu overlay */}
          {contextMenu && (
            <ContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              onDuplicate={() => handleDuplicateNode(contextMenu.nodeId)}
              onDelete={() => {
                setNodes((current) =>
                  current.filter((node) => node.id !== contextMenu.nodeId),
                );
                setEdges((current) =>
                  current.filter(
                    (edge) =>
                      edge.source !== contextMenu.nodeId &&
                      edge.target !== contextMenu.nodeId,
                  ),
                );
                dispatch(setContextMenu(null));
              }}
            />
          )}

          {/* Quick Add Menu overlay */}
          {quickAdd && (
            <QuickAddMenu
              x={quickAdd.x}
              y={quickAdd.y}
              onAddNode={handleQuickAddNode}
              onClose={() => setQuickAdd(null)}
            />
          )}
        </div>

        {/* Node Inspector */}
        {selectedNode && (
          <NodeInspector
            selectedNode={selectedNode}
            nodes={nodes}
            edges={edges}
            setNodes={setNodes}
            setEdges={setEdges}
            onUpdateConfig={updateSelectedNode}
          />
        )}
      </div>

      {/* Deploy Drawer */}
      <DeployDrawer
        open={deployDrawerOpen}
        onClose={() => dispatch(setDeployDrawerOpen(false))}
        deploymentSettings={deploymentSettings}
        onSettingsChange={(settings) =>
          dispatch(setDeploymentSettings(settings))
        }
        deploymentResult={deploymentResult}
        planSummary={enrichedPlanSummary}
        onDeploy={() => {
          void handleDeploy();
        }}
        onPlan={validateAndPlan}
        onOpenProjectSettings={() => dispatch(setProjectSettingsOpen(true))}
        awsAccountId={awsAccountId}
        nodes={nodes}
        edges={edges}
      />

      {/* Help Shortcuts Dialog */}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="border-border bg-[var(--color-bg-surface)] text-foreground sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-foreground">
              Keyboard Shortcuts
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-xs">
            {(['general', 'canvas', 'view', 'edit'] as const).map((cat) => {
              const catShortcuts = shortcuts.filter(
                (s) => s.category === cat && s.key !== 'Backspace',
              );
              if (catShortcuts.length === 0) return null;

              return (
                <div key={cat} className="space-y-2">
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {cat === 'general'
                      ? 'General Actions'
                      : cat === 'canvas'
                        ? 'Canvas Controls'
                        : cat === 'view'
                          ? 'View Options'
                          : 'Editing Tools'}
                  </h4>
                  <div className="space-y-1.5">
                    {catShortcuts.map((shortcut) => {
                      const displayKeys = [];
                      if (shortcut.meta) displayKeys.push('⌘');
                      if (shortcut.alt) displayKeys.push('⌥');
                      if (shortcut.shift) displayKeys.push('⇧');
                      displayKeys.push(
                        shortcut.key === ' ' ? 'Space' : shortcut.key,
                      );

                      return (
                        <div
                          key={
                            shortcut.key +
                            (shortcut.meta ? 'm' : '') +
                            (shortcut.alt ? 'a' : '')
                          }
                          className="flex items-center justify-between border-b border-border/20 py-1 last:border-0"
                        >
                          <span className="text-[11px] text-muted-foreground">
                            {shortcut.description}
                          </span>
                          <div className="flex gap-0.5">
                            {displayKeys.map((k, idx) => (
                              <kbd
                                key={idx}
                                className="rounded border border-border/80 bg-muted px-1.5 py-0.5 font-mono text-[9px] font-bold text-foreground shadow-sm"
                              >
                                {k}
                              </kbd>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Clear Canvas Confirmation */}
      <ConfirmDialog
        open={clearConfirmOpen}
        onOpenChange={setClearConfirmOpen}
        title="Clear Canvas"
        description="Are you sure you want to clear the canvas? This will permanently delete all nodes and connections from the current layout. This action cannot be undone."
        confirmText="Clear Canvas"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={confirmClearCanvas}
      />
    </div>
  );
}
export default CanvasEditor;
