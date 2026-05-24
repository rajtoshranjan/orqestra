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
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type {
  DiagramNode,
  DiagramEdge,
  ServiceNodeData,
  DeploymentSettings,
  DeploymentResult,
  PlanSummary,
  ClipboardSelection,
  ContextMenuState,
  PersistedDiagram,
} from '@/types';
import {
  createServiceNode,
  withValidatedData,
  buildPlan,
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
  API_BASE_URL,
} from '@/utils';
import { registry } from '@/services';
import { toast } from '@/hooks/use-toast';
import { useProject, useUpdateProject, camelToSnakeRecursive } from '@/lib/api';
import {
  EditorToolbar,
  ServiceCatalog,
  NodeInspector,
  DeployDrawer,
  ContextMenu,
} from '@/components';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface EditorProps {
  projectId: string;
  onNavigateHome: () => void;
}

/* ─── Inner Canvas Editor (must be inside ReactFlowProvider) ─────────── */

interface CanvasEditorProps extends EditorProps {
  initialProject: PersistedDiagram;
}

function CanvasEditor({
  initialProject,
  onNavigateHome,
}: CanvasEditorProps) {
  /* ── Build nodeTypes from registry (memoized) ───────────────── */
  const nodeTypes = React.useMemo(() => registry.getNodeTypes(), []);

  /* ── Core state ──────────────────────────────────────────────── */
  const [currentProjectId] = React.useState(initialProject.projectId);
  const [projectName, setProjectName] = React.useState(initialProject.projectName);
  const [projectDescription] = React.useState(initialProject.projectDescription);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialProject.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialProject.edges);
  const [deploymentSettings, setDeploymentSettings] =
    React.useState<DeploymentSettings>(initialProject.deploymentSettings);
  const [lastSavedAt, setLastSavedAt] = React.useState<string | null>(
    initialProject.lastSavedAt,
  );
  const [planSummary, setPlanSummary] = React.useState<PlanSummary>(() =>
    buildPlan(initialProject.nodes, initialProject.edges),
  );
  const [deploymentResult, setDeploymentResult] =
    React.useState<DeploymentResult>({
      status: 'idle',
      logs: [
        createLog(
          'info',
          'Plan the project to review the cloud resources that will be deployed.',
        ),
      ],
      lastRunAt: null,
    });
  const [reactFlowInstance, setReactFlowInstance] =
    React.useState<ReactFlowInstance<ServiceNodeData> | null>(null);

  /* ── Clipboard & Context Menu ───────────────────────────────── */
  const [clipboard, setClipboard] = React.useState<ClipboardSelection | null>(
    null,
  );
  const [contextMenu, setContextMenu] = React.useState<ContextMenuState | null>(
    null,
  );
  const [snapToGrid, setSnapToGrid] = React.useState(true);

  /* ── NEW state ─────────────────────────────────────────────── */
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [deployDrawerOpen, setDeployDrawerOpen] = React.useState(false);

  /* ── Derived ────────────────────────────────────────────────── */
  const selectedNodes = nodes.filter((n) => n.selected);
  const selectedNode = selectedNodes.length === 1 ? selectedNodes[0] : null;
  const invalidNodeCount = nodes.filter((n) =>
    hasValidationErrors(n.data.validationErrors),
  ).length;
  const readyCount = nodes.length - invalidNodeCount;

  /* ── Persist Diagram ────────────────────────────────────────── */
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
        setLastSavedAt(timestamp);
        if (!silent) {
          toast({
            title: 'Project saved',
            description: 'The current architecture project has been saved to the server.',
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
    [updateProjectMutation],
  );

  /* ── Autosave Effect ────────────────────────────────────────── */
  React.useEffect(() => {
    // Skip autosave if nothing changed from initial loaded state
    if (
      nodes === initialProject.nodes &&
      edges === initialProject.edges &&
      deploymentSettings === initialProject.deploymentSettings &&
      projectName === initialProject.projectName
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
        true, // silent = true
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
    initialProject,
  ]);

  /* ── Update helpers ─────────────────────────────────────────── */
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

  /* ── Save ──────────────────────────────────────────────────── */
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

  /* ── Validate & Plan ──────────────────────────────────────── */
  const validateAndPlan = React.useCallback(() => {
    const nextNodes = nodes.map((node) => withValidatedData(node));
    const nextPlan = buildPlan(nextNodes, edges);

    setNodes(nextNodes);
    setPlanSummary(nextPlan);

    if (nextPlan.resourceCount === 0) {
      setDeploymentResult({
        status: 'failed',
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

    if (nextNodes.some((n) => hasValidationErrors(n.data.validationErrors))) {
      setDeploymentResult({
        status: 'failed',
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

    setDeploymentResult({
      status: 'pending',
      lastRunAt: new Date().toISOString(),
      logs: [
        createLog(
          'info',
          `Plan ready: ${nextPlan.resourceCount} cloud resource${nextPlan.resourceCount === 1 ? '' : 's'} prepared for deployment.`,
        ),
      ],
    });

    return { valid: true, plan: nextPlan, nodes: nextNodes };
  }, [edges, nodes, setNodes]);

  /* ── Add Node (generic — works for any service) ────────────── */
  const handleAddNode = React.useCallback(
    (serviceId: string) => {
      updateNodesWithValidation((current) => [
        ...current.map((node) => ({ ...node, selected: false })),
        createServiceNode(
          serviceId,
          { x: 140 + current.length * 36, y: 160 + current.length * 24 },
          current.length + 1,
        ),
      ]);
    },
    [updateNodesWithValidation],
  );

  /* ── Clipboard Operations ───────────────────────────────────── */
  const handleCopySelection = React.useCallback(() => {
    const selection = cloneSelection(nodes, edges);
    if (!selection) {
      toast({
        title: 'Nothing selected',
        description: 'Select one or more nodes before copying.',
      });
      return;
    }
    setClipboard(selection);
    toast({
      title: 'Copied to clipboard',
      description: `${selection.nodes.length} node${selection.nodes.length === 1 ? '' : 's'} ready to paste.`,
    });
  }, [edges, nodes]);

  const handlePasteSelection = React.useCallback(() => {
    if (!clipboard) {
      toast({
        title: 'Clipboard is empty',
        description: 'Copy a selection first to paste it into the canvas.',
      });
      return;
    }
    pasteSelection(clipboard, setNodes, setEdges);
  }, [clipboard, setEdges, setNodes]);

  const deleteSelection = React.useCallback(() => {
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
    setContextMenu(null);
  }, [edges, nodes, setEdges, setNodes]);

  /* ── Duplicate ──────────────────────────────────────────────── */
  const handleDuplicateNode = React.useCallback(
    (nodeId: string) => {
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
      setContextMenu(null);
    },
    [nodes, setNodes],
  );

  /* ── Deploy ─────────────────────────────────────────────────── */
  const handleDeploy = React.useCallback(async () => {
    const { valid, plan, nodes: validatedNodes } = validateAndPlan();

    if (!valid) {
      toast({
        title: 'Deployment blocked',
        description: 'Finish the required resource fields before deploying.',
        variant: 'destructive',
      });
      return;
    }

    setDeploymentResult({
      status: 'in-progress',
      lastRunAt: new Date().toISOString(),
      logs: [
        createLog(
          'info',
          `Starting deployment for ${plan.resourceCount} cloud resource${plan.resourceCount === 1 ? '' : 's'}.`,
        ),
      ],
    });

    try {
      const response = await fetch(`${API_BASE_URL}/api/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(camelToSnakeRecursive({
          diagram: serializeDiagram({
            projectId: currentProjectId,
            projectName,
            projectDescription,
            nodes: validatedNodes,
            edges,
            deploymentSettings,
            lastSavedAt,
          }),
        })),
      });

      const payload = (await response.json()) as {
        error?: string;
        logs?: Array<{ level: 'info' | 'success' | 'error'; message: string }>;
      };

      if (!response.ok) throw new Error(payload.error ?? 'Deployment failed.');

      const logs = payload.logs?.map((entry) =>
        createLog(entry.level, entry.message),
      ) ?? [createLog('success', 'Deployment completed.')];

      setDeploymentResult({
        status: 'success',
        lastRunAt: new Date().toISOString(),
        logs,
      });
      toast({
        title: 'Deployment finished',
        description:
          'The deployment service finished processing the current plan.',
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'The local deployment service could not be reached.';

      setDeploymentResult({
        status: 'failed',
        lastRunAt: new Date().toISOString(),
        logs: [
          createLog(
            'error',
            `${message} Start the server and make sure AWS credentials plus the execution role ARN are configured.`,
          ),
        ],
      });
      toast({
        title: 'Deployment failed',
        description: message,
        variant: 'destructive',
      });
    }
  }, [
    currentProjectId,
    deploymentSettings,
    edges,
    lastSavedAt,
    projectDescription,
    projectName,
    validateAndPlan,
  ]);

  /* ── Keyboard Shortcuts ─────────────────────────────────────── */
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

  /* ── Context menu click-away ──────────────────────────────── */
  React.useEffect(() => {
    const handleClickAway = () => setContextMenu(null);
    window.addEventListener('click', handleClickAway);
    return () => window.removeEventListener('click', handleClickAway);
  }, []);

  /* ── Drop handler for ServiceCatalog drag ─────────────────── */
  const handleDrop = React.useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const serviceId = event.dataTransfer.getData(NODE_DRAG_TYPE);
      if (!serviceId || !reactFlowInstance) return;

      // Verify service exists in registry
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
    [reactFlowInstance, updateNodesWithValidation],
  );

  const handleDragOver = React.useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden"
      style={{ background: 'var(--color-bg-base)' }}
    >
      {/* ── Toolbar ──────────────────────────────────────────── */}
      <EditorToolbar
        projectName={projectName}
        onProjectNameChange={setProjectName}
        onBack={onNavigateHome}
        onSave={saveCurrentDiagram}
        onPlan={() => {
          validateAndPlan();
          setDeployDrawerOpen(true);
        }}
        onDeploy={() => {
          setDeployDrawerOpen(true);
          void handleDeploy();
        }}
        deploymentStatus={deploymentResult.status}
        lastSavedAt={lastSavedAt}
        nodeCount={nodes.length}
        readyCount={readyCount}
        snapToGrid={snapToGrid}
        onToggleSnap={() => setSnapToGrid((c) => !c)}
        isSaving={updateProjectMutation.isPending}
      />

      {/* ── Main Editor Area ─────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Service Catalog */}
        <ServiceCatalog
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
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
            nodes={nodes}
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
              setContextMenu({
                nodeId: node.id,
                x: event.clientX,
                y: event.clientY,
              });
            }}
            onPaneClick={() => setContextMenu(null)}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              color="rgba(255,255,255,0.04)"
              gap={snapToGrid ? GRID[0] : 32}
              size={1.1}
            />
            <Controls position="bottom-right" />
            <MiniMap
              className="!bottom-4 !left-4 !h-28 !w-44 overflow-hidden"
              nodeColor={(node) =>
                countNodeErrors(node as DiagramNode) > 0
                  ? 'var(--color-warning)'
                  : 'var(--color-accent)'
              }
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
                  current.filter((n) => n.id !== contextMenu.nodeId),
                );
                setEdges((current) =>
                  current.filter(
                    (e) =>
                      e.source !== contextMenu.nodeId &&
                      e.target !== contextMenu.nodeId,
                  ),
                );
                setContextMenu(null);
              }}
            />
          )}
        </div>

        {/* Node Inspector */}
        <NodeInspector
          selectedNode={selectedNode}
          onUpdateConfig={updateSelectedNode}
        />
      </div>

      {/* Deploy Drawer */}
      <DeployDrawer
        open={deployDrawerOpen}
        onClose={() => setDeployDrawerOpen(false)}
        deploymentSettings={deploymentSettings}
        onSettingsChange={setDeploymentSettings}
        deploymentResult={deploymentResult}
        planSummary={planSummary}
        onDeploy={() => {
          void handleDeploy();
        }}
        onPlan={validateAndPlan}
      />
    </div>
  );
}

/* ─── Exported Editor (wraps with ReactFlowProvider) ─────────────────── */

export function Editor({ projectId, onNavigateHome }: EditorProps) {
  const { data: project, isLoading, error } = useProject(projectId);

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-[#09090b] text-[#fafafa]">
        {/* Sleek, premium loader */}
        <div className="relative flex h-16 w-16 items-center justify-center">
          <div className="absolute h-full w-full animate-ping rounded-full bg-violet-600/30 opacity-75"></div>
          <div className="relative h-12 w-12 animate-spin rounded-full border-4 border-violet-500 border-t-transparent"></div>
        </div>
        <div className="animate-pulse text-sm font-medium tracking-wide text-zinc-400">
          Loading cloud architecture...
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-[#09090b] text-[#fafafa]">
        <div className="text-xl font-bold text-red-500">Project Not Found</div>
        <p className="text-sm text-zinc-400">
          Failed to load the cloud diagram from the server.
        </p>
        <button
          onClick={onNavigateHome}
          className="rounded-md bg-zinc-800 px-4 py-2 text-sm transition hover:bg-zinc-700"
        >
          Go Back Home
        </button>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <CanvasEditor
        projectId={projectId}
        initialProject={project}
        onNavigateHome={onNavigateHome}
      />
    </ReactFlowProvider>
  );
}
