import type { NodeProps } from 'reactflow';

/* ─── Service Categories ──────────────────────────────────────────────── */

export type ServiceCategory =
  | 'compute'
  | 'storage'
  | 'database'
  | 'networking'
  | 'messaging'
  | 'security'
  | 'monitoring'
  | 'integration';

export const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, string> = {
  compute: 'Compute',
  storage: 'Storage',
  database: 'Database',
  networking: 'Networking',
  messaging: 'Messaging',
  security: 'Security',
  monitoring: 'Monitoring',
  integration: 'Integration',
};

/* ─── Generic Validation ──────────────────────────────────────────────── */

export type ServiceValidationErrors = Record<string, string>;

/* ─── Generic Plan Resource ───────────────────────────────────────────── */

export interface ServicePlanResource {
  id: string;
  cloudFormationType: string;
  name: string;
  connectionCount: number;
  /** Service-specific summary fields shown in the plan card */
  details: Array<{ label: string; value: string }>;
}

/* ─── Service Node Props (for node renderers) ─────────────────────────── */

export interface ServiceNodeProps<TConfig = Record<string, unknown>> {
  data: {
    serviceId: string;
    label: string;
    config: TConfig;
    validationErrors: ServiceValidationErrors;
  };
  selected: boolean;
}

/* ─── Service Inspector Props (for inspector forms) ───────────────────── */

export interface ServiceInspectorProps<TConfig = Record<string, unknown>> {
  config: TConfig;
  validationErrors: ServiceValidationErrors;
  onUpdate: (updater: (prev: TConfig) => TConfig) => void;
}

/* ─── Service Definition (the core plugin interface) ──────────────────── */

export interface ServiceDefinition<TConfig = Record<string, unknown>> {
  /** Unique ID: 'lambda', 's3', 'dynamodb', 'sqs', etc. */
  id: string;

  /** AWS CloudFormation resource type */
  cloudFormationType: string;

  /** Display name for UI: 'AWS Lambda' */
  name: string;

  /** Short name for compact badges: 'Lambda' */
  shortName: string;

  /** Category for sidebar grouping */
  category: ServiceCategory;

  /** Description shown in the service catalog */
  description: string;

  /** Lucide icon component for the service */
  icon: React.ComponentType<{ size?: number | string; className?: string }>;

  /** Accent color (CSS value) for node cards and highlights */
  accentColor: string;

  /* ── Config lifecycle ───────────────────────── */

  /** Create default config for a new node of this service type */
  createDefaultConfig: (index: number) => TConfig;

  /** Validate the config and return field-level errors */
  validate: (config: TConfig) => ServiceValidationErrors;

  /** Extract a human-readable display name from the config */
  getDisplayName: (config: TConfig) => string;

  /* ── React components ──────────────────────── */

  /**
   * ReactFlow node renderer.
   * Receives standard NodeProps with data typed to ServiceNodeProps.
   */
  NodeComponent: React.ComponentType<
    NodeProps<{
      serviceId: string;
      label: string;
      config: TConfig;
      validationErrors: ServiceValidationErrors;
    }>
  >;

  /**
   * Inspector panel form.
   * Rendered inside the NodeInspector wrapper when this service's node is selected.
   */
  InspectorComponent: React.ComponentType<ServiceInspectorProps<TConfig>>;

  /* ── Plan builder ──────────────────────────── */

  /** Build a plan resource summary for the deployment drawer */
  buildPlanResource: (
    nodeId: string,
    config: TConfig,
    connectionCount: number,
  ) => ServicePlanResource;
}
