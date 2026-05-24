import type { Node, Edge } from 'reactflow';
import type { ServiceValidationErrors } from '@/services/types';

/* ─── Re-export service types for convenience ─────────────────────────── */

export type { ServiceValidationErrors } from '@/services/types';
export type { ServiceCategory } from '@/services/types';

/* ─── Deployment ──────────────────────────────────────────────────────── */

export type DeploymentStatus =
  | 'idle'
  | 'pending'
  | 'in-progress'
  | 'success'
  | 'failed';
export type DeploymentLogLevel = 'info' | 'success' | 'error';

export interface DeploymentSettings {
  region: string;
  executionRoleArn: string;
}

export interface DeploymentLogEntry {
  id: string;
  level: DeploymentLogLevel;
  message: string;
}

export interface DeploymentResult {
  status: DeploymentStatus;
  logs: DeploymentLogEntry[];
  lastRunAt: string | null;
}

/* ─── Generic Service Node Data ───────────────────────────────────────── */

/**
 * Generic node data that works for ANY service.
 * The `config` is opaque (Record<string, unknown>) at the framework level.
 * Each service's NodeComponent and InspectorComponent cast it to their specific type.
 */
export interface ServiceNodeData {
  serviceId: string;
  label: string;
  config: Record<string, unknown>;
  validationErrors: ServiceValidationErrors;
}

export type DiagramNode = Node<ServiceNodeData>;
export type DiagramEdge = Edge;

/* ─── Plan ────────────────────────────────────────────────────────────── */

export type { ServicePlanResource } from '@/services/types';

export interface PlanSummary {
  resourceCount: number;
  resources: import('@/services/types').ServicePlanResource[];
}

/* ─── Persistence ─────────────────────────────────────────────────────── */

export interface PersistedDiagram {
  projectId: string;
  projectName: string;
  projectDescription: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  deploymentSettings: DeploymentSettings;
  lastSavedAt: string | null;
}

export interface SavedProjectRecord extends PersistedDiagram {
  updatedAt: string;
}

/* ─── UI State ────────────────────────────────────────────────────────── */

export interface ClipboardSelection {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

export interface ContextMenuState {
  nodeId: string;
  x: number;
  y: number;
}
