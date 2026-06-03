import type { Node, Edge } from 'reactflow';
import type { ServiceValidationErrors } from '@/services/types';

/* Re-export service types for convenience */

export type { ServiceValidationErrors } from '@/services/types';
export type { ServiceCategory } from '@/services/types';

/* Deployment */

export enum DeploymentStatus {
  Idle = 'idle',
  Pending = 'pending',
  InProgress = 'in-progress',
  Success = 'success',
  Failed = 'failed',
}

export type DeploymentLogLevel = 'info' | 'success' | 'error';

export type DeploymentSettings = {
  region: string;
  executionRoleArn: string;
};

export type DeploymentLogEntry = {
  id: string;
  level: DeploymentLogLevel;
  message: string;
};

export type DeploymentResult = {
  status: DeploymentStatus;
  logs: DeploymentLogEntry[];
  lastRunAt: string | null;
};

/* Generic Service Node Data */

/**
 * Generic node data that works for ANY service.
 * The `config` is opaque (Record<string, unknown>) at the framework level.
 * Each service's NodeComponent and InspectorComponent cast it to their specific type.
 */
export type ServiceNodeData = {
  serviceId: string;
  label: string;
  config: Record<string, unknown>;
  validationErrors: ServiceValidationErrors;
};

export type DiagramNode = Node<ServiceNodeData>;
export type DiagramEdge = Edge;

/* Plan */

export type { ServicePlanResource, PlanResourceAction } from '@/services/types';

export type PlanSummary = {
  resourceCount: number;
  resources: import('@/services/types').ServicePlanResource[];
};

/* Persistence */

export type PersistedDiagram = {
  projectId: string;
  projectName: string;
  projectDescription: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  deploymentSettings: DeploymentSettings;
  lastSavedAt: string | null;
};

export type SavedProjectRecord = PersistedDiagram & {
  updatedAt: string;
};

/* UI State */

export type ClipboardSelection = {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
};

export type ContextMenuState = {
  nodeId: string;
  x: number;
  y: number;
};
