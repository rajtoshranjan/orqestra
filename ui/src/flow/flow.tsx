import classNames from "clsx";
import {
  CloudUpload,
  Copy,
  Download,
  FileUp,
  FunctionSquare,
  LayoutGrid,
  LoaderCircle,
  Play,
  Plus,
  Save,
  Trash2,
  WandSparkles,
} from "lucide-react";
import React from "react";
import ReactFlow, {
  addEdge,
  Background,
  BackgroundVariant,
  Connection,
  ConnectionMode,
  Controls,
  Edge,
  Handle,
  MarkerType,
  MiniMap,
  Node,
  NodeProps,
  Position,
  ReactFlowInstance,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from "reactflow";
import { toast } from "@/hooks/use-toast";
import "reactflow/dist/style.css";

type FlowProps = React.HTMLProps<HTMLDivElement>;
type LambdaRuntime = "nodejs20.x" | "nodejs22.x" | "python3.12";
type DeploymentStatus = "idle" | "pending" | "in-progress" | "success" | "failed";
type DeploymentLogLevel = "info" | "success" | "error";
type ServiceType = "lambda";

type LambdaField =
  | "functionName"
  | "runtime"
  | "handler"
  | "code"
  | "memorySize"
  | "timeout"
  | "description"
  | "environmentVariables";

type ValidationErrors = Partial<Record<LambdaField, string>>;

interface LambdaEnvironmentVariable {
  id: string;
  key: string;
  value: string;
}

interface LambdaConfig {
  functionName: string;
  runtime: LambdaRuntime;
  handler: string;
  code: string;
  environmentVariables: LambdaEnvironmentVariable[];
  memorySize: number;
  timeout: number;
  description: string;
}

interface DeploymentSettings {
  region: string;
  executionRoleArn: string;
}

interface LambdaNodeData {
  kind: ServiceType;
  label: string;
  config: LambdaConfig;
  validationErrors: ValidationErrors;
}

interface PersistedDiagram {
  projectId: string;
  projectName: string;
  projectDescription: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  deploymentSettings: DeploymentSettings;
  lastSavedAt: string | null;
}

interface SavedProjectRecord extends PersistedDiagram {
  updatedAt: string;
}

interface DeploymentLogEntry {
  id: string;
  level: DeploymentLogLevel;
  message: string;
}

interface DeploymentResult {
  status: DeploymentStatus;
  logs: DeploymentLogEntry[];
  lastRunAt: string | null;
}

interface PlanResource {
  id: string;
  type: "AWS::Lambda::Function";
  name: string;
  runtime: LambdaRuntime;
  memorySize: number;
  timeout: number;
  environmentVariableCount: number;
  connectionCount: number;
}

interface PlanSummary {
  resourceCount: number;
  resources: PlanResource[];
}

interface ClipboardSelection {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

interface ContextMenuState {
  nodeId: string;
  x: number;
  y: number;
}

type DiagramNode = Node<LambdaNodeData>;
type DiagramEdge = Edge;

const STORAGE_KEY = "draw-to-deploy.projects.v1";
const NODE_DRAG_TYPE = "application/draw-to-deploy.node";
const GRID: [number, number] = [24, 24];
const DEFAULT_DEPLOYMENT_SETTINGS: DeploymentSettings = {
  region: "us-east-1",
  executionRoleArn: "",
};
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

const DEFAULT_NODE_CODE = `exports.handler = async (event) => {
  console.log("Incoming event", JSON.stringify(event));

  return {
    statusCode: 200,
    body: JSON.stringify({
      ok: true,
      message: "Hello from Draw to Deploy",
      receivedAt: new Date().toISOString(),
    }),
  };
};`;

const DEFAULT_PYTHON_CODE = `import json
from datetime import datetime

def lambda_handler(event, context):
    return {
        "statusCode": 200,
        "body": json.dumps({
            "ok": True,
            "message": "Hello from Draw to Deploy",
            "receivedAt": datetime.utcnow().isoformat(),
        }),
    }`;

const runtimeOptions: Array<{ value: LambdaRuntime; label: string }> = [
  { value: "nodejs20.x", label: "Node.js 20" },
  { value: "nodejs22.x", label: "Node.js 22" },
  { value: "python3.12", label: "Python 3.12" },
];

const serviceCatalog: Array<{
  type: ServiceType;
  title: string;
  shortTitle: string;
  description: string;
  badge: string;
}> = [
  {
    type: "lambda",
    title: "AWS Lambda",
    shortTitle: "Lambda",
    description: "Serverless compute with inline code, runtime, memory, timeout, handler, and environment variables.",
    badge: "AWS Compute",
  },
];

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeEnvironmentVariable(): LambdaEnvironmentVariable {
  return {
    id: makeId(),
    key: "",
    value: "",
  };
}

function getDefaultHandlerForRuntime(runtime: LambdaRuntime) {
  return runtime === "python3.12" ? "lambda_function.lambda_handler" : "index.handler";
}

function getDefaultCodeForRuntime(runtime: LambdaRuntime) {
  return runtime === "python3.12" ? DEFAULT_PYTHON_CODE : DEFAULT_NODE_CODE;
}

function getNodeDisplayName(config: LambdaConfig) {
  return config.functionName.trim() || "Lambda Function";
}

function validateLambdaConfig(config: LambdaConfig): ValidationErrors {
  const errors: ValidationErrors = {};
  const trimmedName = config.functionName.trim();
  const trimmedHandler = config.handler.trim();
  const nonEmptyEnvVars = config.environmentVariables.filter(
    (entry) => entry.key.trim() || entry.value.trim()
  );

  if (!trimmedName) {
    errors.functionName = "Function name is required.";
  } else if (!/^[a-zA-Z0-9-_]{1,64}$/.test(trimmedName)) {
    errors.functionName = "Use 1-64 letters, numbers, hyphens, or underscores.";
  }

  if (!config.runtime) {
    errors.runtime = "Choose a Lambda runtime.";
  }

  if (!trimmedHandler) {
    errors.handler = "Handler is required.";
  }

  if (!config.code.trim()) {
    errors.code = "Paste the function code before planning or deploying.";
  }

  if (!Number.isFinite(config.memorySize) || config.memorySize < 128 || config.memorySize > 10240) {
    errors.memorySize = "Memory must be between 128 MB and 10240 MB.";
  }

  if (!Number.isFinite(config.timeout) || config.timeout < 1 || config.timeout > 900) {
    errors.timeout = "Timeout must be between 1 and 900 seconds.";
  }

  const seenEnvKeys = new Set<string>();
  for (const entry of nonEmptyEnvVars) {
    const key = entry.key.trim();
    if (!key) {
      errors.environmentVariables = "Each environment variable needs a key.";
      break;
    }
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) {
      errors.environmentVariables = "Environment keys must start with a letter and use only letters, numbers, or underscores.";
      break;
    }
    if (seenEnvKeys.has(key)) {
      errors.environmentVariables = "Environment variable keys must be unique.";
      break;
    }
    seenEnvKeys.add(key);
  }

  return errors;
}

function hasValidationErrors(errors: ValidationErrors) {
  return Object.values(errors).some(Boolean);
}

function countNodeErrors(node: DiagramNode) {
  return Object.values(node.data.validationErrors).filter(Boolean).length;
}

function normalizeEnvironmentVariables(entries: LambdaEnvironmentVariable[]) {
  return entries.filter((entry) => entry.key.trim() || entry.value.trim());
}

function buildPlan(nodes: DiagramNode[], edges: DiagramEdge[]): PlanSummary {
  const resources = nodes.map((node) => {
    const config = node.data.config;
    const connectedEdges = edges.filter((edge) => edge.source === node.id || edge.target === node.id);

    return {
      id: node.id,
      type: "AWS::Lambda::Function" as const,
      name: getNodeDisplayName(config),
      runtime: config.runtime,
      memorySize: config.memorySize,
      timeout: config.timeout,
      environmentVariableCount: normalizeEnvironmentVariables(config.environmentVariables).length,
      connectionCount: connectedEdges.length,
    };
  });

  return {
    resourceCount: resources.length,
    resources,
  };
}

function createLambdaConfig(index: number): LambdaConfig {
  return {
    functionName: `lambda-${index}`,
    runtime: "nodejs20.x",
    handler: getDefaultHandlerForRuntime("nodejs20.x"),
    code: getDefaultCodeForRuntime("nodejs20.x"),
    environmentVariables: [makeEnvironmentVariable()],
    memorySize: 256,
    timeout: 15,
    description: "Created from the visual editor",
  };
}

function createLambdaNode(position: { x: number; y: number }, index: number): DiagramNode {
  const config = createLambdaConfig(index);

  return {
    id: makeId(),
    type: "lambdaNode",
    position,
    data: {
      kind: "lambda",
      label: getNodeDisplayName(config),
      config,
      validationErrors: validateLambdaConfig(config),
    },
  };
}

function withValidatedData(node: DiagramNode): DiagramNode {
  const validationErrors = validateLambdaConfig(node.data.config);

  return {
    ...node,
    data: {
      ...node.data,
      label: getNodeDisplayName(node.data.config),
      validationErrors,
    },
  };
}

function createProjectName(index = 1) {
  return `Cloud Project ${index}`;
}

function createInitialDiagram(): PersistedDiagram {
  return {
    projectId: makeId(),
    projectName: createProjectName(1),
    projectDescription: "Visual architecture project",
    nodes: [createLambdaNode({ x: 120, y: 140 }, 1)],
    edges: [],
    deploymentSettings: DEFAULT_DEPLOYMENT_SETTINGS,
    lastSavedAt: null,
  };
}

function normalizePersistedDiagram(parsed: Partial<PersistedDiagram>): PersistedDiagram {
  return {
    projectId: parsed.projectId ?? makeId(),
    projectName: parsed.projectName?.trim() || createProjectName(1),
    projectDescription: parsed.projectDescription ?? "Visual architecture project",
    nodes: (parsed.nodes ?? []).map((node) => withValidatedData({ ...node, selected: false })),
    edges: parsed.edges ?? [],
    deploymentSettings: parsed.deploymentSettings ?? DEFAULT_DEPLOYMENT_SETTINGS,
    lastSavedAt: parsed.lastSavedAt ?? null,
  };
}

function readProjectCollection(): SavedProjectRecord[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as SavedProjectRecord[];
    return parsed.map((project) => ({
      ...normalizePersistedDiagram(project),
      updatedAt: project.updatedAt ?? project.lastSavedAt ?? new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

function readPersistedDiagram(): PersistedDiagram {
  const projects = readProjectCollection();
  if (projects.length === 0) {
    return createInitialDiagram();
  }

  const [latestProject] = [...projects].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  return normalizePersistedDiagram(latestProject);
}

function serializeDiagram(diagram: PersistedDiagram): PersistedDiagram {
  return {
    ...diagram,
    nodes: diagram.nodes.map((node) => ({
      ...withValidatedData(node),
      selected: false,
      dragging: false,
    })),
    edges: diagram.edges.map((edge) => ({ ...edge, selected: false })),
  };
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "Not saved yet";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function isInputElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select" || Boolean(target.closest("[contenteditable='true']"));
}

function createLog(level: DeploymentLogLevel, message: string): DeploymentLogEntry {
  return {
    id: makeId(),
    level,
    message,
  };
}

function cloneSelection(nodes: DiagramNode[], edges: DiagramEdge[]): ClipboardSelection | null {
  const selectedNodes = nodes.filter((node) => node.selected);
  if (selectedNodes.length === 0) {
    return null;
  }

  const selectedIds = new Set(selectedNodes.map((node) => node.id));
  const selectedEdges = edges.filter((edge) => selectedIds.has(edge.source) && selectedIds.has(edge.target));

  return {
    nodes: selectedNodes,
    edges: selectedEdges,
  };
}

function pasteSelection(
  selection: ClipboardSelection,
  setNodes: React.Dispatch<React.SetStateAction<DiagramNode[]>>,
  setEdges: React.Dispatch<React.SetStateAction<DiagramEdge[]>>
) {
  const idMap = new Map<string, string>();

  const nextNodes = selection.nodes.map((node) => {
    const id = makeId();
    idMap.set(node.id, id);
    return {
      ...withValidatedData({
        ...node,
        id,
        position: {
          x: node.position.x + 48,
          y: node.position.y + 48,
        },
        selected: true,
      }),
    };
  });

  const nextEdges = selection.edges.map((edge) => ({
    ...edge,
    id: makeId(),
    source: idMap.get(edge.source) ?? edge.source,
    target: idMap.get(edge.target) ?? edge.target,
    selected: true,
  }));

  setNodes((current) => [...current.map((node) => ({ ...node, selected: false })), ...nextNodes]);
  setEdges((current) => [...current.map((edge) => ({ ...edge, selected: false })), ...nextEdges]);
}

function LambdaNode({ data, selected }: NodeProps<LambdaNodeData>) {
  const errorCount = Object.values(data.validationErrors).filter(Boolean).length;

  return (
    <div
      className={classNames(
        "min-w-[240px] rounded-2xl border bg-white/95 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.12)] backdrop-blur",
        selected ? "border-sky-500 ring-2 ring-sky-200" : "border-slate-200",
        errorCount > 0 && "border-amber-400"
      )}
    >
      <Handle className="!h-3 !w-3 !bg-sky-500" position={Position.Left} type="target" />
      <Handle className="!h-3 !w-3 !bg-sky-500" position={Position.Right} type="source" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
            AWS Lambda
          </div>
          <div className="mt-2 text-base font-semibold text-slate-900">{data.label}</div>
          <div className="mt-1 text-xs text-slate-500">{data.config.runtime}</div>
        </div>
        <div className="rounded-xl bg-amber-50 p-2 text-amber-600">
          <FunctionSquare className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <span>{data.config.memorySize} MB</span>
        <span>{data.config.timeout}s timeout</span>
      </div>
      {errorCount > 0 ? (
        <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
          {errorCount} field{errorCount > 1 ? "s" : ""} need attention
        </div>
      ) : (
        <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
          Ready for planning
        </div>
      )}
    </div>
  );
}

const nodeTypes = {
  lambdaNode: LambdaNode,
};

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="mt-1 text-xs font-medium text-rose-600">{message}</p>;
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
      <div className="mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{title}</h2>
        {description ? <p className="mt-2 text-sm text-slate-600">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function CanvasEditor({ className, ...rest }: FlowProps) {
  const initialDiagramRef = React.useRef<PersistedDiagram>(readPersistedDiagram());
  const [projectId, setProjectId] = React.useState(initialDiagramRef.current.projectId);
  const [projectName, setProjectName] = React.useState(initialDiagramRef.current.projectName);
  const [projectDescription, setProjectDescription] = React.useState(initialDiagramRef.current.projectDescription);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialDiagramRef.current.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialDiagramRef.current.edges);
  const [deploymentSettings, setDeploymentSettings] = React.useState<DeploymentSettings>(
    initialDiagramRef.current.deploymentSettings
  );
  const [lastSavedAt, setLastSavedAt] = React.useState<string | null>(initialDiagramRef.current.lastSavedAt);
  const [savedProjects, setSavedProjects] = React.useState<SavedProjectRecord[]>(() => readProjectCollection());
  const [snapToGrid, setSnapToGrid] = React.useState(true);
  const [clipboard, setClipboard] = React.useState<ClipboardSelection | null>(null);
  const [contextMenu, setContextMenu] = React.useState<ContextMenuState | null>(null);
  const [planSummary, setPlanSummary] = React.useState<PlanSummary>(() =>
    buildPlan(initialDiagramRef.current.nodes, initialDiagramRef.current.edges)
  );
  const [deploymentResult, setDeploymentResult] = React.useState<DeploymentResult>({
    status: "idle",
    logs: [createLog("info", "Plan the project to review the cloud resources that will be deployed.")],
    lastRunAt: null,
  });
  const [reactFlowInstance, setReactFlowInstance] = React.useState<ReactFlowInstance<LambdaNodeData> | null>(null);
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const selectedNodes = nodes.filter((node) => node.selected);
  const selectedNode = selectedNodes.length === 1 ? selectedNodes[0] : null;
  const selectedService = selectedNode ? serviceCatalog.find((service) => service.type === selectedNode.data.kind) : null;
  const invalidNodeCount = nodes.filter((node) => hasValidationErrors(node.data.validationErrors)).length;
  const readyNodeCount = nodes.length - invalidNodeCount;

  const persistDiagram = React.useCallback(
    (
      nextProjectId: string,
      nextProjectName: string,
      nextProjectDescription: string,
      nextNodes: DiagramNode[],
      nextEdges: DiagramEdge[],
      nextSettings: DeploymentSettings
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
      const existingProjects = readProjectCollection().filter((project) => project.projectId !== nextProjectId);
      const nextProjects: SavedProjectRecord[] = [
        {
          ...payload,
          updatedAt: timestamp,
        },
        ...existingProjects,
      ];
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextProjects));
      setSavedProjects(nextProjects);
      setLastSavedAt(timestamp);
      toast({
        title: "Project saved",
        description: "The current architecture project is stored locally in your browser.",
      });
    },
    []
  );

  const updateNodesWithValidation = React.useCallback((updater: (current: DiagramNode[]) => DiagramNode[]) => {
    setNodes((current) => updater(current).map((node) => withValidatedData(node)));
  }, [setNodes]);

  const updateSelectedNode = React.useCallback(
    (updater: (config: LambdaConfig) => LambdaConfig) => {
      if (!selectedNode) {
        return;
      }

      updateNodesWithValidation((current) =>
        current.map((node) => {
          if (node.id !== selectedNode.id) {
            return node;
          }

          const nextConfig = updater(node.data.config);
          return {
            ...node,
            data: {
              ...node.data,
              config: nextConfig,
              label: getNodeDisplayName(nextConfig),
            },
          };
        })
      );
    },
    [selectedNode, updateNodesWithValidation]
  );

  const saveCurrentDiagram = React.useCallback(() => {
    persistDiagram(projectId, projectName, projectDescription, nodes, edges, deploymentSettings);
  }, [deploymentSettings, edges, nodes, persistDiagram, projectDescription, projectId, projectName]);

  const loadProject = React.useCallback(
    (saved: PersistedDiagram) => {
      setProjectId(saved.projectId);
      setProjectName(saved.projectName);
      setProjectDescription(saved.projectDescription);
      setNodes(saved.nodes);
      setEdges(saved.edges);
      setDeploymentSettings(saved.deploymentSettings);
      setLastSavedAt(saved.lastSavedAt);
      setPlanSummary(buildPlan(saved.nodes, saved.edges));
      setDeploymentResult({
        status: "idle",
        logs: [createLog("info", `Loaded project ${saved.projectName}.`)],
        lastRunAt: null,
      });
      toast({
        title: "Project loaded",
        description: `${saved.projectName} is ready in the canvas.`,
      });
    },
    [setEdges, setNodes]
  );

  const loadSavedDiagram = React.useCallback(() => {
    const saved = readPersistedDiagram();
    loadProject(saved);
  }, [loadProject]);

  const createFreshDiagram = React.useCallback(() => {
    const next = createInitialDiagram();
    const nextProjectCount = readProjectCollection().length + 1;
    const nextProjectName = createProjectName(nextProjectCount);
    setProjectId(next.projectId);
    setProjectName(nextProjectName);
    setProjectDescription("Visual architecture project");
    setNodes(next.nodes);
    setEdges(next.edges);
    setDeploymentSettings(next.deploymentSettings);
    setLastSavedAt(null);
    setPlanSummary(buildPlan(next.nodes, next.edges));
    setDeploymentResult({
      status: "idle",
      logs: [createLog("info", "Started a fresh cloud architecture project.")],
      lastRunAt: null,
    });
    setContextMenu(null);
  }, [setEdges, setNodes]);

  const validateAndPlan = React.useCallback(() => {
    const nextNodes = nodes.map((node) => withValidatedData(node));
    const nextPlan = buildPlan(nextNodes, edges);

    setNodes(nextNodes);
    setPlanSummary(nextPlan);

    if (nextPlan.resourceCount === 0) {
      setDeploymentResult({
        status: "failed",
        lastRunAt: new Date().toISOString(),
        logs: [createLog("error", "Add at least one resource node before planning or deploying.")],
      });
      return { valid: false, plan: nextPlan, nodes: nextNodes };
    }

    if (nextNodes.some((node) => hasValidationErrors(node.data.validationErrors))) {
      setDeploymentResult({
        status: "failed",
        lastRunAt: new Date().toISOString(),
        logs: [
          createLog(
            "error",
            "Some resources still have invalid configuration fields. Fix the highlighted errors and try again."
          ),
        ],
      });
      return { valid: false, plan: nextPlan, nodes: nextNodes };
    }

    setDeploymentResult({
      status: "pending",
      lastRunAt: new Date().toISOString(),
      logs: [
        createLog(
          "info",
          `Plan ready: ${nextPlan.resourceCount} cloud resource${nextPlan.resourceCount === 1 ? "" : "s"} prepared for deployment.`
        ),
      ],
    });

    return { valid: true, plan: nextPlan, nodes: nextNodes };
  }, [edges, nodes, setNodes]);

  const handleAddNode = React.useCallback(() => {
    updateNodesWithValidation((current) =>
      [
        ...current.map((node) => ({ ...node, selected: false })),
        createLambdaNode({ x: 140 + current.length * 36, y: 160 + current.length * 24 }, current.length + 1),
      ]
    );
  }, [updateNodesWithValidation]);

  const handleCopySelection = React.useCallback(() => {
    const selection = cloneSelection(nodes, edges);

    if (!selection) {
      toast({
        title: "Nothing selected",
        description: "Select one or more nodes before copying.",
      });
      return;
    }

    setClipboard(selection);
    toast({
      title: "Copied to clipboard",
      description: `${selection.nodes.length} node${selection.nodes.length === 1 ? "" : "s"} ready to paste.`,
    });
  }, [edges, nodes]);

  const handlePasteSelection = React.useCallback(() => {
    if (!clipboard) {
      toast({
        title: "Clipboard is empty",
        description: "Copy a selection first to paste it into the canvas.",
      });
      return;
    }

    pasteSelection(clipboard, setNodes, setEdges);
  }, [clipboard, setEdges, setNodes]);

  const deleteSelection = React.useCallback(() => {
    const selectedNodeIds = new Set(nodes.filter((node) => node.selected).map((node) => node.id));
    const selectedEdgeIds = new Set(edges.filter((edge) => edge.selected).map((edge) => edge.id));

    if (selectedNodeIds.size === 0 && selectedEdgeIds.size === 0) {
      return;
    }

    setNodes((current) => current.filter((node) => !selectedNodeIds.has(node.id)));
    setEdges((current) =>
      current.filter(
        (edge) =>
          !selectedEdgeIds.has(edge.id) &&
          !selectedNodeIds.has(edge.source) &&
          !selectedNodeIds.has(edge.target)
      )
    );
    setContextMenu(null);
  }, [edges, nodes, setEdges, setNodes]);

  const handleDuplicateNode = React.useCallback(
    (nodeId: string) => {
      const node = nodes.find((item) => item.id === nodeId);
      if (!node) {
        return;
      }

      setNodes((current) =>
        [
          ...current.map((item) => ({ ...item, selected: false })),
          {
            ...withValidatedData({
              ...node,
              id: makeId(),
              position: {
                x: node.position.x + 56,
                y: node.position.y + 56,
              },
              selected: true,
            }),
          },
        ]
      );
      setContextMenu(null);
    },
    [nodes, setNodes]
  );

  const handleDeploy = React.useCallback(async () => {
    const { valid, plan, nodes: validatedNodes } = validateAndPlan();

    if (!valid) {
      toast({
        title: "Deployment blocked",
        description: "Finish the required resource fields before deploying.",
        variant: "destructive",
      });
      return;
    }

    setDeploymentResult({
      status: "in-progress",
      lastRunAt: new Date().toISOString(),
      logs: [
        createLog("info", `Starting deployment for ${plan.resourceCount} cloud resource${plan.resourceCount === 1 ? "" : "s"}.`),
      ],
    });

    try {
      const response = await fetch(`${API_BASE_URL}/api/deploy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          diagram: serializeDiagram({
            projectId,
            projectName,
            projectDescription,
            nodes: validatedNodes,
            edges,
            deploymentSettings,
            lastSavedAt,
          }),
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        logs?: Array<{ level: DeploymentLogLevel; message: string }>;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Deployment failed.");
      }

      const logs =
        payload.logs?.map((entry) => createLog(entry.level, entry.message)) ??
        [createLog("success", "Deployment completed.")];

      setDeploymentResult({
        status: "success",
        lastRunAt: new Date().toISOString(),
        logs,
      });
      toast({
        title: "Deployment finished",
        description: "The deployment service finished processing the current plan.",
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The local deployment service could not be reached.";

      setDeploymentResult({
        status: "failed",
        lastRunAt: new Date().toISOString(),
        logs: [
          createLog(
            "error",
            `${message} Start the server and make sure AWS credentials plus the execution role ARN are configured.`
          ),
        ],
      });
      toast({
        title: "Deployment failed",
        description: message,
        variant: "destructive",
      });
    }
  }, [deploymentSettings, edges, lastSavedAt, projectDescription, projectId, projectName, validateAndPlan]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isInputElement(event.target)) {
        return;
      }

      const metaKey = event.metaKey || event.ctrlKey;
      if (metaKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveCurrentDiagram();
        return;
      }

      if (metaKey && event.key.toLowerCase() === "c") {
        event.preventDefault();
        handleCopySelection();
        return;
      }

      if (metaKey && event.key.toLowerCase() === "v") {
        event.preventDefault();
        handlePasteSelection();
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelection();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteSelection, handleCopySelection, handlePasteSelection, saveCurrentDiagram]);

  React.useEffect(() => {
    const handleClickAway = () => setContextMenu(null);
    window.addEventListener("click", handleClickAway);
    return () => window.removeEventListener("click", handleClickAway);
  }, []);

  return (
    <div className={classNames("min-h-screen bg-[#f4f7fb]", className)} {...rest}>
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-[0_12px_30px_rgba(15,23,42,0.22)]">
              <FunctionSquare className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-sky-700">Draw to Deploy</div>
              <div className="text-sm text-slate-500">Cloud architecture workspace</div>
            </div>
          </div>
          <div className="hidden items-center gap-8 text-sm text-slate-500 lg:flex">
            <span className="font-medium text-slate-900">Projects</span>
            <span>Services</span>
            <span>Deployments</span>
            <span>Settings</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 md:block">
              AWS workspace
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-700">
              DT
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] px-6 py-6">
        <div className="rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#16233b_45%,#1d4ed8_100%)] p-6 text-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="text-xs font-semibold uppercase tracking-[0.32em] text-sky-200">Cloud design studio</div>
              <h1 className="mt-3 font-['Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',serif] text-4xl font-semibold leading-tight text-white">
                Architect, validate, and deploy cloud systems from one SaaS workspace.
              </h1>
              <p className="mt-4 text-sm leading-6 text-slate-200">
                Create reusable infrastructure projects, design systems visually, configure resources in context, and turn the architecture into a deployment plan. Lambda is the first supported AWS service in a platform designed to grow into a full cloud catalog.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15"
                onClick={createFreshDiagram}
                type="button"
              >
                <FileUp className="h-4 w-4" />
                New project
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15"
                onClick={loadSavedDiagram}
                type="button"
              >
                <Download className="h-4 w-4" />
                Load project
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-[0_14px_30px_rgba(15,23,42,0.18)] transition hover:bg-slate-100"
                onClick={saveCurrentDiagram}
                type="button"
              >
                <Save className="h-4 w-4" />
                Save
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-full border border-sky-300/40 bg-sky-400/15 px-4 py-2 text-sm font-medium text-sky-100 transition hover:bg-sky-400/20"
                onClick={validateAndPlan}
                type="button"
              >
                <WandSparkles className="h-4 w-4" />
                Plan
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-medium text-white shadow-[0_14px_30px_rgba(5,150,105,0.26)] transition hover:bg-emerald-400"
                onClick={() => {
                  void handleDeploy();
                }}
                type="button"
              >
                {deploymentResult.status === "in-progress" ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <CloudUpload className="h-4 w-4" />
                )}
                Deploy
              </button>
            </div>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-300">Project</div>
              <div className="mt-2 text-lg font-semibold text-white">{projectName}</div>
              <div className="mt-1 text-sm text-slate-300">{projectDescription || "Architecture workspace"}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-300">Resources</div>
              <div className="mt-2 text-2xl font-semibold text-white">{nodes.length}</div>
              <div className="mt-1 text-sm text-slate-300">Nodes on the canvas</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-300">Ready</div>
              <div className="mt-2 text-2xl font-semibold text-white">{readyNodeCount}</div>
              <div className="mt-1 text-sm text-slate-300">Valid resources</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-300">Saved Projects</div>
              <div className="mt-2 text-2xl font-semibold text-white">{savedProjects.length}</div>
              <div className="mt-1 text-sm text-slate-300">Available locally</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-300">Last Saved</div>
              <div className="mt-2 text-lg font-semibold text-white">{formatTimestamp(lastSavedAt)}</div>
              <div className="mt-1 text-sm text-slate-300">Current workspace state</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1600px] gap-6 px-6 pb-8 xl:grid-cols-[300px_minmax(0,1fr)_380px]">
        <aside className="space-y-5">
          <Section
            title="Project"
            description="Each architecture is a project. Name it clearly so multiple systems can live side by side."
          >
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500" htmlFor="project-name">
                  Project name
                </label>
                <input
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  id="project-name"
                  onChange={(event) => setProjectName(event.target.value)}
                  placeholder="Payments Platform"
                  value={projectName}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500" htmlFor="project-description">
                  Project summary
                </label>
                <textarea
                  className="mt-2 min-h-[88px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  id="project-description"
                  onChange={(event) => setProjectDescription(event.target.value)}
                  placeholder="High-level purpose, scope, or environment notes"
                  value={projectDescription}
                />
              </div>
            </div>
          </Section>

          <Section
            title="Service Catalog"
            description="The canvas is service-agnostic. Lambda is the first registered AWS resource in the catalog, with more services meant to slot in here."
          >
            <div className="space-y-3">
              {serviceCatalog.map((service) => (
                <button
                  className="group flex w-full cursor-grab items-start gap-4 rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-50 to-cyan-50 p-4 text-left transition hover:border-sky-300 hover:shadow-md active:cursor-grabbing"
                  draggable
                  key={service.type}
                  onClick={handleAddNode}
                  onDragStart={(event) => {
                    event.dataTransfer.setData(NODE_DRAG_TYPE, service.type);
                    event.dataTransfer.effectAllowed = "copy";
                  }}
                  type="button"
                >
                  <div className="rounded-2xl bg-white p-3 text-sky-600 shadow-sm">
                    <FunctionSquare className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">{service.badge}</div>
                    <div className="mt-1 font-semibold text-slate-900">{service.title}</div>
                    <div className="mt-1 text-sm text-slate-600">{service.description}</div>
                    <div className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-sky-700">
                      Drag to canvas or click to add
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Section>

          <Section
            title="Saved Projects"
            description="Jump between locally saved architecture projects without overwriting the current one."
          >
            <div className="space-y-3">
              {savedProjects.length > 0 ? (
                savedProjects.slice(0, 6).map((project) => (
                  <button
                    className={classNames(
                      "w-full rounded-2xl border px-4 py-3 text-left transition shadow-sm",
                      project.projectId === projectId
                        ? "border-sky-300 bg-sky-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    )}
                    key={project.projectId}
                    onClick={() => loadProject(project)}
                    type="button"
                  >
                    <div className="font-medium text-slate-900">{project.projectName}</div>
                    <div className="mt-1 text-xs text-slate-500">{project.nodes.length} resources</div>
                    <div className="mt-2 text-xs text-slate-400">{formatTimestamp(project.updatedAt)}</div>
                  </button>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                  Save a project to build up your local project library.
                </div>
              )}
            </div>
          </Section>

          <Section title="Canvas Controls" description="A familiar diagram-tool workflow for fast iteration.">
            <div className="space-y-3 text-sm text-slate-600">
              <button
                className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:bg-slate-100"
                onClick={() => setSnapToGrid((current) => !current)}
                type="button"
              >
                <span className="inline-flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4" />
                  Snap to grid
                </span>
                <span className={classNames("rounded-full px-3 py-1 text-xs font-semibold", snapToGrid ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600")}>
                  {snapToGrid ? "On" : "Off"}
                </span>
              </button>
              <button
                className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:bg-slate-100"
                onClick={handleCopySelection}
                type="button"
              >
                <span className="inline-flex items-center gap-2">
                  <Copy className="h-4 w-4" />
                  Copy selection
                </span>
                <span className="text-xs font-medium text-slate-500">Ctrl/Cmd + C</span>
              </button>
              <button
                className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:bg-slate-100"
                onClick={handlePasteSelection}
                type="button"
              >
                <span className="inline-flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Paste selection
                </span>
                <span className="text-xs font-medium text-slate-500">Ctrl/Cmd + V</span>
              </button>
              <button
                className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:bg-slate-100"
                onClick={deleteSelection}
                type="button"
              >
                <span className="inline-flex items-center gap-2">
                  <Trash2 className="h-4 w-4" />
                  Delete selection
                </span>
                <span className="text-xs font-medium text-slate-500">Delete</span>
              </button>
            </div>
          </Section>
        </aside>

        <section className="relative min-h-[720px] overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-5 py-4">
            <div>
              <div className="text-sm font-semibold text-slate-900">Architecture canvas</div>
              <div className="text-xs text-slate-500">
                Drag resources, connect them visually, and right-click any node for quick actions.
              </div>
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              onClick={handleAddNode}
              type="button"
            >
              <Play className="h-4 w-4" />
              Add resource
            </button>
          </div>
            <div
              ref={wrapperRef}
            className="h-[calc(100%-73px)] bg-[linear-gradient(180deg,#fbfdff_0%,#f7faff_100%)]"
            onDrop={(event) => {
              event.preventDefault();
              const type = event.dataTransfer.getData(NODE_DRAG_TYPE);
              if (type !== "lambda" || !reactFlowInstance) {
                return;
              }

              const position = reactFlowInstance.screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
              });

              updateNodesWithValidation((current) =>
                [
                  ...current.map((node) => ({ ...node, selected: false })),
                  createLambdaNode(position, current.length + 1),
                ]
              );
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
            }}
          >
            <ReactFlow
              connectionMode={ConnectionMode.Loose}
              defaultViewport={{ x: 0, y: 0, zoom: 0.95 }}
              deleteKeyCode={null}
              edgeUpdaterRadius={24}
              edges={edges}
              fitView
              minZoom={0.3}
              nodeTypes={nodeTypes}
              nodes={nodes}
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
                        color: "#0f172a",
                      },
                      style: {
                        stroke: "#0f172a",
                        strokeWidth: 2,
                      },
                      type: "smoothstep",
                    },
                    current
                  )
                );
              }}
              onEdgesChange={onEdgesChange}
              onInit={setReactFlowInstance}
              onNodeContextMenu={(event, node) => {
                event.preventDefault();
                setContextMenu({
                  nodeId: node.id,
                  x: event.clientX,
                  y: event.clientY,
                });
              }}
              onNodesChange={onNodesChange}
              onPaneClick={() => setContextMenu(null)}
              onSelectionChange={({ nodes: selected }) => {
                if (selected.length <= 1) {
                  setContextMenu(null);
                }
              }}
              panOnDrag
              preventScrolling={false}
              proOptions={{ hideAttribution: true }}
              selectionOnDrag
              snapGrid={GRID}
              snapToGrid={snapToGrid}
              zoomOnScroll={false}
            >
              <Background color="#d8e1ec" gap={snapToGrid ? GRID[0] : 32} size={1.1} variant={BackgroundVariant.Dots} />
              <Controls position="bottom-right" />
              <MiniMap
                className="!bottom-5 !left-5 !h-28 !w-44 overflow-hidden rounded-2xl border border-slate-200 bg-white/90 shadow-xl"
                nodeColor={(node) => (countNodeErrors(node as DiagramNode) > 0 ? "#f59e0b" : "#0ea5e9")}
                pannable
                zoomable
              />
            </ReactFlow>
          </div>

          {contextMenu ? (
            <div
              className="fixed z-[70] min-w-[180px] rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_24px_60px_rgba(15,23,42,0.18)]"
              style={{ left: contextMenu.x, top: contextMenu.y }}
            >
              <button
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                onClick={() => handleDuplicateNode(contextMenu.nodeId)}
                type="button"
              >
                <Copy className="h-4 w-4" />
                Duplicate node
              </button>
              <button
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50"
                onClick={() => {
                  setNodes((current) => current.filter((node) => node.id !== contextMenu.nodeId));
                  setEdges((current) =>
                    current.filter((edge) => edge.source !== contextMenu.nodeId && edge.target !== contextMenu.nodeId)
                  );
                  setContextMenu(null);
                }}
                type="button"
              >
                <Trash2 className="h-4 w-4" />
                Delete node
              </button>
            </div>
          ) : null}
        </section>

        <aside className="space-y-5">
          <Section
            title="Resource Inspector"
            description={
              selectedNode
                ? "Edit the selected resource configuration. Validation updates as you type."
                : "Select one resource node to edit its configuration."
            }
          >
            {selectedNode ? (
              <div className="space-y-4">
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Resource type</div>
                  <div className="mt-1 text-sm font-medium text-slate-900">{selectedService?.title ?? "AWS Resource"}</div>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500" htmlFor="function-name">
                    Resource name
                  </label>
                  <input
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:bg-white"
                    id="function-name"
                    onChange={(event) =>
                      updateSelectedNode((config) => ({
                        ...config,
                        functionName: event.target.value,
                      }))
                    }
                    value={selectedNode.data.config.functionName}
                  />
                  <FieldError message={selectedNode.data.validationErrors.functionName} />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500" htmlFor="runtime">
                      Runtime
                    </label>
                    <select
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:bg-white"
                      id="runtime"
                      onChange={(event) =>
                        updateSelectedNode((config) => {
                          const nextRuntime = event.target.value as LambdaRuntime;
                          const defaultHandler = getDefaultHandlerForRuntime(config.runtime);
                          const defaultCode = getDefaultCodeForRuntime(config.runtime);

                          return {
                            ...config,
                            runtime: nextRuntime,
                            handler:
                              config.handler === defaultHandler
                                ? getDefaultHandlerForRuntime(nextRuntime)
                                : config.handler,
                            code:
                              config.code === defaultCode
                                ? getDefaultCodeForRuntime(nextRuntime)
                                : config.code,
                          };
                        })
                      }
                      value={selectedNode.data.config.runtime}
                    >
                      {runtimeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <FieldError message={selectedNode.data.validationErrors.runtime} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500" htmlFor="handler">
                      Handler
                    </label>
                    <input
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:bg-white"
                      id="handler"
                      onChange={(event) =>
                        updateSelectedNode((config) => ({
                          ...config,
                          handler: event.target.value,
                        }))
                      }
                      value={selectedNode.data.config.handler}
                    />
                    <FieldError message={selectedNode.data.validationErrors.handler} />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500" htmlFor="memory-size">
                      Memory size (MB)
                    </label>
                    <input
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:bg-white"
                      id="memory-size"
                      min={128}
                      onChange={(event) =>
                        updateSelectedNode((config) => ({
                          ...config,
                          memorySize: Number(event.target.value),
                        }))
                      }
                      step={64}
                      type="number"
                      value={selectedNode.data.config.memorySize}
                    />
                    <FieldError message={selectedNode.data.validationErrors.memorySize} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500" htmlFor="timeout">
                      Timeout (seconds)
                    </label>
                    <input
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:bg-white"
                      id="timeout"
                      min={1}
                      onChange={(event) =>
                        updateSelectedNode((config) => ({
                          ...config,
                          timeout: Number(event.target.value),
                        }))
                      }
                      type="number"
                      value={selectedNode.data.config.timeout}
                    />
                    <FieldError message={selectedNode.data.validationErrors.timeout} />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500" htmlFor="description">
                    Description
                  </label>
                  <input
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:bg-white"
                    id="description"
                    onChange={(event) =>
                      updateSelectedNode((config) => ({
                        ...config,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Optional summary shown in AWS"
                    value={selectedNode.data.config.description}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500" htmlFor="code">
                      Function code
                    </label>
                    <span className="text-xs text-slate-400">Inline editor for MVP</span>
                  </div>
                  <textarea
                    className="mt-2 min-h-[220px] w-full rounded-[1.4rem] border border-slate-200 bg-slate-950 px-4 py-4 font-mono text-sm text-slate-100 outline-none transition focus:border-sky-400"
                    id="code"
                    onChange={(event) =>
                      updateSelectedNode((config) => ({
                        ...config,
                        code: event.target.value,
                      }))
                    }
                    spellCheck={false}
                    value={selectedNode.data.config.code}
                  />
                  <FieldError message={selectedNode.data.validationErrors.code} />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Environment variables
                    </label>
                    <button
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                      onClick={() =>
                        updateSelectedNode((config) => ({
                          ...config,
                          environmentVariables: config.environmentVariables.concat(makeEnvironmentVariable()),
                        }))
                      }
                      type="button"
                    >
                      Add variable
                    </button>
                  </div>
                  <div className="mt-3 space-y-3">
                    {selectedNode.data.config.environmentVariables.map((entry) => (
                      <div className="grid grid-cols-[1fr_1fr_auto] gap-2" key={entry.id}>
                        <input
                          className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-sky-400 focus:bg-white"
                          onChange={(event) =>
                            updateSelectedNode((config) => ({
                              ...config,
                              environmentVariables: config.environmentVariables.map((variable) =>
                                variable.id === entry.id ? { ...variable, key: event.target.value } : variable
                              ),
                            }))
                          }
                          placeholder="KEY"
                          value={entry.key}
                        />
                        <input
                          className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-sky-400 focus:bg-white"
                          onChange={(event) =>
                            updateSelectedNode((config) => ({
                              ...config,
                              environmentVariables: config.environmentVariables.map((variable) =>
                                variable.id === entry.id ? { ...variable, value: event.target.value } : variable
                              ),
                            }))
                          }
                          placeholder="value"
                          value={entry.value}
                        />
                        <button
                          className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 transition hover:bg-slate-50"
                          onClick={() =>
                            updateSelectedNode((config) => ({
                              ...config,
                              environmentVariables:
                                config.environmentVariables.length === 1
                                  ? [makeEnvironmentVariable()]
                                  : config.environmentVariables.filter((variable) => variable.id !== entry.id),
                            }))
                          }
                          type="button"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <FieldError message={selectedNode.data.validationErrors.environmentVariables} />
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                Click a node on the canvas to configure the selected resource.
              </div>
            )}
          </Section>

          <Section
            title="Deployment"
            description="Global settings for the current project and the resulting deployment activity."
          >
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500" htmlFor="region">
                  AWS region
                </label>
                <input
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:bg-white"
                  id="region"
                  onChange={(event) =>
                    setDeploymentSettings((current) => ({
                      ...current,
                      region: event.target.value,
                    }))
                  }
                  placeholder="us-east-1"
                  value={deploymentSettings.region}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500" htmlFor="role-arn">
                  Execution role ARN
                </label>
                <input
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:bg-white"
                  id="role-arn"
                  onChange={(event) =>
                    setDeploymentSettings((current) => ({
                      ...current,
                      executionRoleArn: event.target.value,
                    }))
                  }
                  placeholder="Optional if server has AWS_LAMBDA_EXECUTION_ROLE_ARN"
                  value={deploymentSettings.executionRoleArn}
                />
              </div>
            </div>

            <div className="mt-5 rounded-3xl bg-slate-950 p-4 text-slate-100">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Resource plan</div>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs">{planSummary.resourceCount} resources</span>
              </div>
              <div className="mt-4 space-y-3">
                {planSummary.resources.length > 0 ? (
                  planSummary.resources.map((resource) => (
                    <div className="rounded-2xl bg-white/5 px-4 py-3" key={resource.id}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium">{resource.name}</div>
                          <div className="mt-1 text-xs text-slate-300">
                            {resource.runtime} • {resource.memorySize} MB • {resource.timeout}s
                          </div>
                        </div>
                        <span className="rounded-full bg-white/10 px-3 py-1 text-xs">
                          {resource.connectionCount} connection{resource.connectionCount === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl bg-white/5 px-4 py-3 text-sm text-slate-300">
                    Add resources to generate a deployment plan.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">Deployment activity</div>
                <span
                  className={classNames(
                    "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]",
                    deploymentResult.status === "success" && "bg-emerald-100 text-emerald-700",
                    deploymentResult.status === "failed" && "bg-rose-100 text-rose-700",
                    (deploymentResult.status === "pending" || deploymentResult.status === "in-progress") &&
                      "bg-amber-100 text-amber-700",
                    deploymentResult.status === "idle" && "bg-slate-100 text-slate-600"
                  )}
                >
                  {deploymentResult.status}
                </span>
              </div>
              <div className="mt-3 space-y-2 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                {deploymentResult.logs.map((entry) => (
                  <div className="flex items-start gap-3 text-sm" key={entry.id}>
                    <span
                      className={classNames(
                        "mt-1 h-2.5 w-2.5 rounded-full",
                        entry.level === "info" && "bg-sky-500",
                        entry.level === "success" && "bg-emerald-500",
                        entry.level === "error" && "bg-rose-500"
                      )}
                    />
                    <span className="text-slate-700">{entry.message}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Last run: {formatTimestamp(deploymentResult.lastRunAt)}
              </div>
            </div>
          </Section>
        </aside>
      </div>
    </div>
  );
}

export const Flow: React.FC<FlowProps> = (props) => {
  return (
    <ReactFlowProvider>
      <CanvasEditor {...props} />
    </ReactFlowProvider>
  );
};
