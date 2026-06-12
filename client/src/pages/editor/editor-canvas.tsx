import React from 'react';

import { AlertTriangle } from 'lucide-react';
import ReactFlow, {
  addEdge,
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MiniMap,
  MarkerType,
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

import { useProjectDeploymentState, useCreateDeployment } from '@/api';
import { ConfirmDialog } from '@/components/ui';
import { useActiveDeploymentResult } from '@/hooks/use-active-deployment-result';
import { toast } from '@/hooks/use-toast';
import { registry } from '@/services';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  setDeploymentSettings,
  setActiveDeploymentId,
} from '@/store/deployment-slice';
import {
  setNodes as setReduxNodes,
  setEdges as setReduxEdges,
  setClipboard,
} from '@/store/editor-slice';
import {
  setDeployDrawerOpen,
  setProjectSettingsOpen,
  setContextMenu,
  setCommentMode,
} from '@/store/ui-slice';
import type {
  DiagramNode,
  DiagramEdge,
  ServiceNodeData,
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
  cloneSelection,
  pasteSelection,
  makeId,
  GRID,
  NODE_DRAG_TYPE,
  getNodeAbsolutePosition,
  hasValidationErrors,
  createLog,
  findBestParentForPosition,
  adjustParentSizes,
} from '@/utils';
import { autoLayoutDiagram } from '@/utils/auto-layout';

import { CanvasEmptyState } from './canvas-empty-state';
import { CanvasShortcutsDialog } from './canvas-shortcuts-dialog';
import {
  PRO_OPTIONS,
  CONTAINER_CHILD_PADDING,
  CONTAINER_HEADER_HEIGHT,
  getMiniMapNodeColor,
  findBestParentForDraggedNode,
} from './canvas-utils';
import { CommentLayer } from './comments/comment-layer';
import { CommentsSidebar } from './comments/comments-sidebar';
import { useComments } from './comments/use-comments';
import { ContextMenu } from './context-menu';
import { DeployDrawer } from './deploy-drawer';
import { EditorToolbar } from './editor-toolbar';
import { NodeInspector } from './node-inspector';
import { QuickAddMenu } from './quick-add-menu';
import { ServiceCatalog } from './service-catalog';
import { useCanvasPersistence } from './use-canvas-persistence';
import { useCanvasShortcuts } from './use-canvas-shortcuts';
import { useEnrichedEdges } from './use-enriched-edges';
import { useEnrichedNodes } from './use-enriched-nodes';

import type { EnrichedServiceNodeData } from './canvas-utils';
import type { OriginalProjectSnapshot } from './use-canvas-persistence';

type CanvasEditorProps = {
  initialProject: PersistedDiagram;
  onNavigateHome: () => void;
};

export function CanvasEditor({
  initialProject,
  onNavigateHome,
}: CanvasEditorProps) {
  const dispatch = useAppDispatch();

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
  const { deployDrawerOpen, contextMenu, theme, commentMode } = useAppSelector(
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
  const [sidebarCollapsed, setSidebarCollapsed] = useLocalStorage(
    'sidebarCollapsed',
    false,
  );
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = React.useState(false);
  const [reactFlowInstance, setReactFlowInstance] =
    React.useState<ReactFlowInstance<ServiceNodeData> | null>(null);

  const { deploymentResult: queryDeploymentResult } =
    useActiveDeploymentResult(currentProjectId);

  const deploymentResult = React.useMemo(() => {
    if (activeDeploymentId) return queryDeploymentResult;
    return localValidationResult || queryDeploymentResult;
  }, [activeDeploymentId, queryDeploymentResult, localValidationResult]);

  const nodeTypes = React.useMemo(() => registry.getNodeTypes(), []);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialProject.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialProject.edges);

  const nodesRef = React.useRef(nodes);
  const edgesRef = React.useRef(edges);
  const deploymentResultRef = React.useRef(deploymentResult);
  nodesRef.current = nodes;
  edgesRef.current = edges;
  deploymentResultRef.current = deploymentResult;

  const originalProjectRef = React.useRef<OriginalProjectSnapshot>({
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

  const deployedGraphNodes = projectDeploymentState?.lastDeployment
    ?.graphSnapshot?.nodes as DiagramNode[] | undefined;

  /* Node enrichment (deployment status, connection state, z-index) */
  const { enrichedNodes } = useEnrichedNodes({
    nodes,
    setNodes,
    deployedGraphNodes,
    connectingSource,
    dragOverNodeId,
  });

  /* Edge enrichment (labels, colors, animations) */
  const { enrichedEdges } = useEnrichedEdges({ edges, nodes });

  /* Collaboration & annotations */
  const comments = useComments({
    projectId: currentProjectId,
    nodes,
    edges,
    reactFlowInstance,
  });

  const toggleCommentMode = React.useCallback(() => {
    dispatch(setCommentMode(!commentMode));
    dispatch(setContextMenu(null));
  }, [dispatch, commentMode]);

  const handleOpenAnnotation = React.useCallback(
    (annotationId: string, projectId: string) => {
      if (projectId !== currentProjectId) {
        toast({
          title: 'Comment in another project',
          description: 'Open that project to view this discussion.',
        });
        return;
      }
      dispatch(setCommentMode(true));
      comments.jumpToAnnotation(annotationId);
    },
    [currentProjectId, dispatch, comments],
  );

  /* Plan */
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

  /* Persistence & autosave */
  const { persistDiagram, isSaving } = useCanvasPersistence({
    currentProjectId,
    projectName,
    projectDescription,
    awsAccountId,
    nodes,
    edges,
    deploymentSettings,
    originalProjectRef,
  });

  /* Sync nodes/edges to Redux */
  React.useEffect(() => {
    dispatch(setReduxNodes(nodes));
  }, [nodes, dispatch]);
  React.useEffect(() => {
    dispatch(setReduxEdges(edges));
  }, [edges, dispatch]);

  /* Validation on every diagram change */
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
    if (hasChanges) setNodes(nextNodes);
  }, [edges, nodes, setNodes]);

  /* Auto-remove redundant edges (direct parent→child connections) */
  React.useEffect(() => {
    if (nodes.length === 0 || edges.length === 0) return;
    const isAncestor = (ancestorId: string, descendantId: string): boolean => {
      let current = nodes.find((n) => n.id === descendantId);
      while (current && current.parentNode) {
        if (current.parentNode === ancestorId) return true;
        current = nodes.find((n) => n.id === current!.parentNode);
      }
      return false;
    };
    const nextEdges = edges.filter(
      (edge) =>
        !isAncestor(edge.source, edge.target) &&
        !isAncestor(edge.target, edge.source),
    );
    if (nextEdges.length !== edges.length) setEdges(nextEdges);
  }, [nodes, edges, setEdges]);

  /* Context menu click-away */
  React.useEffect(() => {
    const handleClickAway = () => dispatch(setContextMenu(null));
    window.addEventListener('click', handleClickAway);
    return () => window.removeEventListener('click', handleClickAway);
  }, [dispatch]);

  const selectedNodes = nodes.filter((node) => node.selected);
  const selectedNode = selectedNodes.length === 1 ? selectedNodes[0] : null;

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

  /* Node drag handlers */
  const onNodeDrag = React.useCallback<NodeDragHandler>((_event, node) => {
    const draggedNode = node as DiagramNode;
    const { bestParent } = findBestParentForDraggedNode(
      draggedNode,
      nodesRef.current,
    );
    const nextDragOverNodeId = bestParent?.id ?? null;
    setDragOverNodeId((cur) =>
      cur === nextDragOverNodeId ? cur : nextDragOverNodeId,
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
            if (previousNode.id !== draggedNode.id) return previousNode;
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
          if (previousNode.id !== draggedNode.id) return previousNode;
          return {
            ...previousNode,
            parentNode: undefined,
            position: absoluteDraggedPosition,
            data: {
              ...previousNode.data,
              config: { ...previousNode.data.config, parentId: undefined },
            },
          };
        }),
      );
    },
    [setNodes],
  );

  /* Connection handlers */
  const onConnectStart = React.useCallback<OnConnectStart>((_event, params) => {
    if (params.nodeId) setConnectingSource(params.nodeId);
  }, []);

  const onConnectEnd = React.useCallback<OnConnectEnd>(() => {
    setConnectingSource(null);
  }, []);

  const handleConnect = React.useCallback<OnConnect>(
    (connection) => {
      if (!connection.source || !connection.target) return;

      const currentNodes = nodesRef.current;
      const sourceNode = currentNodes.find(
        (node) => node.id === connection.source,
      );
      const targetNode = currentNodes.find(
        (node) => node.id === connection.target,
      );

      const isAncestor = (
        ancestorId: string,
        descendantId: string,
      ): boolean => {
        let current = currentNodes.find((n) => n.id === descendantId);
        while (current && current.parentNode) {
          if (current.parentNode === ancestorId) return true;
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
          icon: <AlertTriangle className="size-4 text-warning" />,
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

  /* Canvas actions */
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
      setQuickAdd({ x: event.clientX, y: event.clientY, flowPosition });
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
      nodes.filter((n) => n.selected).map((n) => n.id),
    );
    const selectedEdgeIds = new Set(
      edges.filter((e) => e.selected).map((e) => e.id),
    );
    if (selectedNodeIds.size === 0 && selectedEdgeIds.size === 0) return;
    setNodes((current) => current.filter((n) => !selectedNodeIds.has(n.id)));
    setEdges((current) =>
      current.filter(
        (e) =>
          !selectedEdgeIds.has(e.id) &&
          !selectedNodeIds.has(e.source) &&
          !selectedNodeIds.has(e.target),
      ),
    );
    dispatch(setContextMenu(null));
  }, [edges, nodes, setEdges, setNodes, dispatch, isLocked]);

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
    updateNodesWithValidation((current) =>
      autoLayoutDiagram(current, edgesRef.current),
    );
    toast({
      title: 'Auto Layout Applied',
      description: 'Arranged nodes into clean grids and containers.',
    });
  }, [updateNodesWithValidation]);

  const handlePlan = React.useCallback(() => {
    const isDeploying =
      deploymentResultRef.current.status === DeploymentStatus.Pending ||
      deploymentResultRef.current.status === DeploymentStatus.InProgress;
    if (!isDeploying) validateAndPlan();
    dispatch(setDeployDrawerOpen(true));
  }, [validateAndPlan, dispatch]);

  const handleApplyStarter = React.useCallback(
    (starter: { nodes: DiagramNode[]; edges: DiagramEdge[] }) => {
      updateNodesWithValidation(() =>
        autoLayoutDiagram(starter.nodes, starter.edges),
      );
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
        prevNodes.map((node) => ({ ...node, selected: node.id === nodeId })),
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

  /* Keyboard shortcuts */
  const shortcuts = useCanvasShortcuts({
    isLocked,
    snapToGrid,
    reactFlowInstance,
    mouseRef,
    nodesRef,
    setNodes,
    setQuickAdd,
    setHelpOpen,
    handleTriggerAutoLayout,
    handlePlan,
    saveCurrentDiagram,
    handleCopySelection,
    handlePasteSelection,
    deleteSelection,
    toggleCommentMode,
  });

  /* Drop from ServiceCatalog */
  const handleDrop = React.useCallback(
    (event: React.DragEvent) => {
      if (isLocked) return;
      event.preventDefault();
      const serviceId = event.dataTransfer.getData(NODE_DRAG_TYPE);
      if (!serviceId || !reactFlowInstance) return;
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
          const PADDING = 24;
          const HEADER_HEIGHT = 56;
          let relativeX = position.x - parentPos.x;
          let relativeY = position.y - parentPos.y;
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

  const handleNodeContextMenu = React.useCallback<NodeMouseHandler>(
    (event, node) => {
      event.preventDefault();
      if (isLocked) return;
      dispatch(
        setContextMenu({
          kind: 'node',
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

  const handlePaneContextMenu = React.useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault();
      if (commentMode) return;
      const flowPosition = reactFlowInstance?.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      dispatch(
        setContextMenu({
          kind: 'pane',
          x: event.clientX,
          y: event.clientY,
          flowPosition,
        }),
      );
    },
    [dispatch, reactFlowInstance, commentMode],
  );

  const handleReactFlowError = React.useCallback<OnError>((id, message) => {
    if (id === '008') return;
    console.warn(`[React Flow Warning] ${id}: ${message}`);
  }, []);

  const handleToggleSidebarCollapse = React.useCallback(() => {
    setSidebarCollapsed((cur) => !cur);
  }, [setSidebarCollapsed]);

  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden"
      style={{ background: 'var(--color-bg-base)' }}
    >
      <EditorToolbar
        onBack={onNavigateHome}
        onPlan={handlePlan}
        onAutoLayout={handleTriggerAutoLayout}
        isSaving={isSaving}
        deploymentStatus={deploymentResult.status}
        onSelectNode={handleSelectNode}
        onHelp={() => setHelpOpen(true)}
        onClearCanvas={handleClearCanvas}
        commentMode={commentMode}
        onToggleCommentMode={toggleCommentMode}
        onOpenAnnotation={handleOpenAnnotation}
      />

      <div className="flex flex-1 overflow-hidden">
        <ServiceCatalog
          collapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleSidebarCollapse}
          onAddNode={handleAddNode}
        />

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
            onPaneContextMenu={handlePaneContextMenu}
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

          {nodes.length === 0 && (
            <CanvasEmptyState onApplyStarter={handleApplyStarter} />
          )}

          {contextMenu && (
            <ContextMenu
              kind={contextMenu.kind}
              x={contextMenu.x}
              y={contextMenu.y}
              onAddComment={() => {
                if (contextMenu.kind === 'node' && contextMenu.nodeId) {
                  comments.startDraftForNode(contextMenu.nodeId);
                } else if (contextMenu.flowPosition) {
                  comments.startDraftAtFlowPosition(contextMenu.flowPosition);
                }
                dispatch(setContextMenu(null));
              }}
              onDuplicate={
                contextMenu.kind === 'node'
                  ? () => handleDuplicateNode(contextMenu.nodeId!)
                  : undefined
              }
              onDelete={
                contextMenu.kind === 'node'
                  ? () => {
                      setNodes((current) =>
                        current.filter(
                          (node) => node.id !== contextMenu.nodeId,
                        ),
                      );
                      setEdges((current) =>
                        current.filter(
                          (edge) =>
                            edge.source !== contextMenu.nodeId &&
                            edge.target !== contextMenu.nodeId,
                        ),
                      );
                      dispatch(setContextMenu(null));
                    }
                  : undefined
              }
            />
          )}

          {quickAdd && (
            <QuickAddMenu
              x={quickAdd.x}
              y={quickAdd.y}
              onAddNode={handleQuickAddNode}
              onClose={() => setQuickAdd(null)}
            />
          )}

          <CommentLayer
            comments={comments}
            commentMode={commentMode}
            nodes={nodes}
            edges={edges}
          />
        </div>

        {commentMode && <CommentsSidebar comments={comments} />}

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

      <CanvasShortcutsDialog
        open={helpOpen}
        onOpenChange={setHelpOpen}
        shortcuts={shortcuts}
      />

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
