import React from 'react';
import ReactFlow, {
  addEdge,
  Background,
  BackgroundVariant,
  Connection,
  ConnectionMode,
  Controls,
  MiniMap,
  MarkerType,
  ReactFlowInstance,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useLocalStorage } from 'usehooks-ts';
import { useQueryClient } from '@tanstack/react-query';
import { EditorToolbar } from './editor-toolbar';
import { ServiceCatalog } from './service-catalog';
import { NodeInspector } from './node-inspector';
import { DeployDrawer } from './deploy-drawer';
import { ContextMenu } from './context-menu';
import type {
  DiagramNode,
  DiagramEdge,
  ServiceNodeData,
  DeploymentSettings,
  PlanSummary,
  PersistedDiagram,
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
  isInputElement,
  makeId,
  GRID,
  NODE_DRAG_TYPE,
} from '@/utils';
import { registry } from '@/services';
import { toast } from '@/hooks/use-toast';
import {
  useUpdateProject,
  useDeployment,
  useProjectDeploymentState,
  useProjectDeployments,
  useCreateDeployment,
} from '@/api';
import { useAppDispatch, useAppSelector } from '@/store';

import {
  setNodes as setReduxNodes,
  setEdges as setReduxEdges,
  setLastSavedAt,
  setClipboard,
} from '@/store/editor-slice';
import {
  setDeploymentSettings,
  setDeploymentResult,
  setActiveDeploymentId,
} from '@/store/deployment-slice';
import { setDeployDrawerOpen, setContextMenu } from '@/store/ui-slice';

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
    snapToGrid,
    isLocked,
    clipboard,
  } = useAppSelector((state) => state.editor);

  const {
    settings: deploymentSettings,
    activeDeploymentId,
    result: deploymentResult,
  } = useAppSelector((state) => state.deployment);

  const { deployDrawerOpen, contextMenu, theme } = useAppSelector(
    (state) => state.ui,
  );

  const queryClient = useQueryClient();
  const createDeploymentMutation = useCreateDeployment();
  const { data: projectDeploymentState } =
    useProjectDeploymentState(currentProjectId);
  const { data: projectDeployments } = useProjectDeployments(currentProjectId);
  const { data: activeDeployment } = useDeployment(activeDeploymentId, true);

  // Resume polling if the latest deployment is still running when the page loads.
  React.useEffect(() => {
    const latestDeployment = projectDeployments?.[0];
    if (
      !activeDeploymentId &&
      latestDeployment &&
      !['succeeded', 'failed'].includes(latestDeployment.status)
    ) {
      dispatch(setActiveDeploymentId(latestDeployment.id));
    }
  }, [activeDeploymentId, projectDeployments, dispatch]);

  // Initialize deployment result from the latest deployment state on load.
  React.useEffect(() => {
    const latestDeployment = projectDeployments?.[0];
    if (
      !activeDeploymentId &&
      latestDeployment &&
      deploymentResult.status === DeploymentStatus.Idle
    ) {
      let status = DeploymentStatus.Idle;
      if (latestDeployment.status === 'succeeded') {
        status = DeploymentStatus.Success;
      } else if (latestDeployment.status === 'failed') {
        status = DeploymentStatus.Failed;
      } else if (
        ['pending', 'generating', 'invoking', 'in_progress'].includes(
          latestDeployment.status,
        )
      ) {
        status = DeploymentStatus.InProgress;
      }

      const logs =
        latestDeployment.logs.map((log, index) => ({
          id: `${latestDeployment.id}-log-${index}`,
          level: log.level as 'info' | 'success' | 'error',
          message: log.message,
        })) || [];

      if (
        latestDeployment.errorMessage &&
        !logs.some((log) => log.message.includes(latestDeployment.errorMessage))
      ) {
        logs.push({
          id: `${latestDeployment.id}-error`,
          level: 'error' as const,
          message: latestDeployment.errorMessage,
        });
      }

      dispatch(
        setDeploymentResult({
          status,
          logs,
          lastRunAt: latestDeployment.completedAt || latestDeployment.createdAt,
        }),
      );
    }
  }, [
    activeDeploymentId,
    projectDeployments,
    deploymentResult.status,
    dispatch,
  ]);

  // Synchronize active deployment query updates to Redux.
  React.useEffect(() => {
    if (activeDeployment) {
      let status = DeploymentStatus.Idle;
      if (activeDeployment.status === 'succeeded') {
        status = DeploymentStatus.Success;
      } else if (activeDeployment.status === 'failed') {
        status = DeploymentStatus.Failed;
      } else if (
        ['pending', 'generating', 'invoking', 'in_progress'].includes(
          activeDeployment.status,
        )
      ) {
        status = DeploymentStatus.InProgress;
      }

      const logs =
        activeDeployment.logs.map((log, index) => ({
          id: `${activeDeployment.id}-log-${index}`,
          level: log.level as 'info' | 'success' | 'error',
          message: log.message,
        })) || [];

      if (
        activeDeployment.errorMessage &&
        !logs.some((log) => log.message.includes(activeDeployment.errorMessage))
      ) {
        logs.push({
          id: `${activeDeployment.id}-error`,
          level: 'error' as const,
          message: activeDeployment.errorMessage,
        });
      }

      dispatch(
        setDeploymentResult({
          status,
          logs,
          lastRunAt: activeDeployment.completedAt || activeDeployment.createdAt,
        }),
      );
    }
  }, [activeDeployment, dispatch]);

  // Watch for active deployment completion
  const lastActiveStatusRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!activeDeployment) {
      lastActiveStatusRef.current = null;
      return;
    }

    const currentStatus = activeDeployment.status;
    const previousStatus = lastActiveStatusRef.current;

    if (currentStatus !== previousStatus) {
      lastActiveStatusRef.current = currentStatus;

      if (currentStatus === 'succeeded') {
        toast({
          title: 'Deployment succeeded',
          description:
            'All cloud resources have been successfully provisioned.',
        });
        void queryClient.invalidateQueries({
          queryKey: ['project-deployment-state', currentProjectId],
        });
        void queryClient.invalidateQueries({
          queryKey: ['project-deployments', currentProjectId],
        });
      } else if (currentStatus === 'failed') {
        toast({
          title: 'Deployment failed',
          description:
            activeDeployment.errorMessage ||
            'An error occurred during deployment.',
          variant: 'destructive',
        });
        void queryClient.invalidateQueries({
          queryKey: ['project-deployment-state', currentProjectId],
        });
        void queryClient.invalidateQueries({
          queryKey: ['project-deployments', currentProjectId],
        });
      }
    }
  }, [activeDeployment, currentProjectId, queryClient]);
  const [sidebarCollapsed, setSidebarCollapsed] = useLocalStorage(
    'sidebarCollapsed',
    false,
  );

  /* Build nodeTypes from registry (memoized) */
  const nodeTypes = React.useMemo(() => registry.getNodeTypes(), []);

  /* Local ReactFlow state (maintains smooth 60fps canvas performance) */
  const [nodes, setNodes, onNodesChange] = useNodesState(initialProject.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialProject.edges);

  // Use projectDeploymentState for indicators — only updated after successful deploys.
  const deployedGraphNodes = projectDeploymentState?.lastDeployment
    ?.graphSnapshot?.nodes as DiagramNode[] | undefined;

  const enrichedNodes = React.useMemo(() => {
    return nodes.map((node) => {
      const lastDeployedNode = deployedGraphNodes?.find(
        (deployedNode) => deployedNode.id === node.id,
      );

      let deploymentStatus: 'not_deployed' | 'deployed' | 'dirty' =
        'not_deployed';
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

      return {
        ...node,
        data: {
          ...node.data,
          deploymentStatus,
        },
      };
    });
  }, [nodes, deployedGraphNodes]);

  const [planSummary, setPlanSummary] = React.useState<PlanSummary>(() =>
    buildPlan(initialProject.nodes, initialProject.edges),
  );

  const enrichedPlanSummary = React.useMemo(() => {
    const diffPlan = enrichPlanWithDeploymentDiff(
      planSummary,
      deployedGraphNodes ?? null,
      nodes,
    );

    return {
      ...diffPlan,
      resources: diffPlan.resources.map((resource) => {
        const enrichedNode = enrichedNodes.find(
          (node) => node.id === resource.id,
        );
        return {
          ...resource,
          deploymentStatus:
            enrichedNode?.data?.deploymentStatus ?? 'not_deployed',
        };
      }),
    };
  }, [planSummary, enrichedNodes, deployedGraphNodes, nodes]);
  const [reactFlowInstance, setReactFlowInstance] =
    React.useState<ReactFlowInstance<ServiceNodeData> | null>(null);

  // Capture initial mount state to prevent autosave loop from refetches.
  const originalProjectRef = React.useRef({
    nodes: initialProject.nodes,
    edges: initialProject.edges,
    deploymentSettings: initialProject.deploymentSettings,
    projectName: initialProject.projectName,
    projectDescription: initialProject.projectDescription,
  });

  /* Sync nodes and edges into Redux for query/deploy selections. */
  React.useEffect(() => {
    dispatch(setReduxNodes(nodes));
  }, [nodes, dispatch]);

  React.useEffect(() => {
    dispatch(setReduxEdges(edges));
  }, [edges, dispatch]);

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
    // Skip autosave if nothing changed from initial loaded state.
    if (
      nodes === originalProjectRef.current.nodes &&
      edges === originalProjectRef.current.edges &&
      deploymentSettings === originalProjectRef.current.deploymentSettings &&
      projectName === originalProjectRef.current.projectName &&
      projectDescription === originalProjectRef.current.projectDescription
    ) {
      return;
    }

    const timer = setTimeout(() => {
      void persistDiagram(
        currentProjectId,
        projectName,
        projectDescription,
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
    currentProjectId,
    persistDiagram,
  ]);

  /* Update helpers */
  const updateNodesWithValidation = React.useCallback(
    (updater: (current: DiagramNode[]) => DiagramNode[]) => {
      setNodes((current) =>
        updater(current).map((node) => withValidatedData(node)),
      );
    },
    [setNodes],
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
      nodes,
      edges,
      deploymentSettings,
    );
  }, [
    currentProjectId,
    deploymentSettings,
    edges,
    nodes,
    persistDiagram,
    projectDescription,
    projectName,
  ]);

  /* Validate & Plan */
  const validateAndPlan = React.useCallback(() => {
    const nextNodes = nodes.map((node) => withValidatedData(node));
    const nextPlan = buildPlan(nextNodes, edges);

    setNodes(nextNodes);
    setPlanSummary(nextPlan);

    dispatch(setActiveDeploymentId(null));

    if (nextPlan.resourceCount === 0) {
      dispatch(
        setDeploymentResult({
          status: DeploymentStatus.Failed,
          lastRunAt: new Date().toISOString(),
          logs: [
            createLog(
              'error',
              'Add at least one resource node before planning or deploying.',
            ),
          ],
        }),
      );
      return { valid: false, plan: nextPlan, nodes: nextNodes };
    }

    if (
      nextNodes.some((node) => hasValidationErrors(node.data.validationErrors))
    ) {
      dispatch(
        setDeploymentResult({
          status: DeploymentStatus.Failed,
          lastRunAt: new Date().toISOString(),
          logs: [
            createLog(
              'error',
              'Some resources still have invalid configuration fields. Fix the highlighted errors and try again.',
            ),
          ],
        }),
      );
      return { valid: false, plan: nextPlan, nodes: nextNodes };
    }

    dispatch(
      setDeploymentResult({
        status: DeploymentStatus.Pending,
        lastRunAt: new Date().toISOString(),
        logs: [
          createLog(
            'info',
            `Plan ready: ${nextPlan.resourceCount} cloud resource${nextPlan.resourceCount === 1 ? '' : 's'} prepared for deployment.`,
          ),
        ],
      }),
    );

    return { valid: true, plan: nextPlan, nodes: nextNodes };
  }, [edges, nodes, setNodes, dispatch]);

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
          ...withValidatedData({
            ...node,
            id: makeId(),
            position: { x: node.position.x + 56, y: node.position.y + 56 },
            selected: true,
          }),
        },
      ]);
      dispatch(setContextMenu(null));
    },
    [nodes, setNodes, dispatch, isLocked],
  );

  /* Deploy */
  const handleDeploy = React.useCallback(async () => {
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
      validatedNodes,
      edges,
      deploymentSettings,
      true,
    );

    try {
      const deployment =
        await createDeploymentMutation.mutateAsync(currentProjectId);
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

      toast({
        title: 'Deployment failed',
        description: message,
        variant: 'destructive',
      });
    }
  }, [
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

  /* Keyboard Shortcuts */
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isInputElement(event.target)) return;

      const metaKey = event.metaKey || event.ctrlKey;
      if (metaKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveCurrentDiagram();
        return;
      }
      if (metaKey && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        handleCopySelection();
        return;
      }
      if (metaKey && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        handlePasteSelection();
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        deleteSelection();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    deleteSelection,
    handleCopySelection,
    handlePasteSelection,
    saveCurrentDiagram,
  ]);

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

      updateNodesWithValidation((current) => [
        ...current.map((node) => ({ ...node, selected: false })),
        createServiceNode(serviceId, position, current.length + 1),
      ]);
    },
    [reactFlowInstance, updateNodesWithValidation, isLocked],
  );

  const handleDragOver = React.useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden"
      style={{ background: 'var(--color-bg-base)' }}
    >
      {/* Toolbar */}
      <EditorToolbar
        onBack={onNavigateHome}
        onPlan={() => {
          const isDeploying =
            deploymentResult.status === DeploymentStatus.Pending ||
            deploymentResult.status === DeploymentStatus.InProgress;

          if (!isDeploying) {
            validateAndPlan();
          }
          dispatch(setDeployDrawerOpen(true));
        }}
        isSaving={updateProjectMutation.isPending}
      />

      {/* Main Editor Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Service Catalog */}
        <ServiceCatalog
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
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
            nodeTypes={nodeTypes}
            snapGrid={GRID}
            snapToGrid={snapToGrid}
            nodesDraggable={!isLocked}
            nodesConnectable={!isLocked}
            elementsSelectable={!isLocked}
            nodes={enrichedNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onInit={setReactFlowInstance}
            onConnect={(connection: Connection) => {
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
            }}
            onNodeContextMenu={(event, node) => {
              event.preventDefault();
              if (isLocked) return;
              dispatch(
                setContextMenu({
                  nodeId: node.id,
                  x: event.clientX,
                  y: event.clientY,
                }),
              );
            }}
            onPaneClick={() => dispatch(setContextMenu(null))}
            proOptions={{ hideAttribution: true }}
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
              nodeColor={(node) => {
                const diagNode: DiagramNode = node;
                return countNodeErrors(diagNode) > 0
                  ? 'var(--color-warning)'
                  : 'var(--color-accent)';
              }}
              pannable
              zoomable
            />
          </ReactFlow>

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
        </div>

        {/* Node Inspector */}
        {selectedNode && (
          <NodeInspector
            selectedNode={selectedNode}
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
      />
    </div>
  );
}
export default CanvasEditor;
