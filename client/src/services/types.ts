import type { NodeProps, Node, Edge } from 'reactflow';

/* Service Categories. */

export type ServiceCategory =
  | 'compute'
  | 'storage'
  | 'database'
  | 'networking'
  | 'messaging'
  | 'security'
  | 'monitoring'
  | 'integration'
  | 'boundaries';

export const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, string> = {
  compute: 'Compute',
  storage: 'Storage',
  database: 'Database',
  networking: 'Networking',
  messaging: 'Messaging',
  security: 'Security',
  monitoring: 'Monitoring',
  integration: 'Integration',
  boundaries: 'Deployment Boundaries',
};

/* Generic Validation. */

export type ServiceValidationErrors = Record<string, string>;

/* Generic Plan Resource. */

export type PlanResourceAction = 'create' | 'update' | 'destroy' | 'no_change';

export type ServicePlanResource = {
  id: string;
  cloudFormationType: string;
  name: string;
  connectionCount: number;
  details: Array<{ label: string; value: string }>;
  action?: PlanResourceAction;
};

/* Service Node Props (for node renderers). */

export type ServiceNodeProps<TConfig = Record<string, unknown>> = {
  data: {
    serviceId: string;
    label: string;
    config: TConfig;
    validationErrors: ServiceValidationErrors;
  };
  selected: boolean;
};

/* Service Inspector Props (for inspector forms). */

export type ServiceInspectorProps<TConfig = Record<string, unknown>> = {
  config: TConfig;
  validationErrors: ServiceValidationErrors;
  onUpdate: (updater: (prev: TConfig) => TConfig) => void;
};

/* Validation Rule — declarative graph-level rule declared on a ServiceDefinition. */

export type ValidationContext = {
  node: Node<any>;
  nodes: Node<any>[];
  edges: Edge<any>[];
};

/**
 * A declarative validation rule attached to a service definition.
 * check() returns true when the rule is VIOLATED (an error exists).
 */
export type ValidationRule = {
  id: string;
  message: string;
  severity?: 'error' | 'warning';
  check: (context: ValidationContext) => boolean;
};

/* Cost Profile — plugged into the cost estimation engine. */

export type CostProfile = {
  /** Relative cost tier for quick UI display. */
  tier: 'free' | 'low' | 'medium' | 'high' | 'variable';
  /** Fixed monthly base cost in USD (optional). */
  baseMonthlyCost?: number;
  /**
   * Return the estimated monthly cost in USD for a given config.
   * Called by the cost estimator engine for each matching node.
   */
  estimate?: (config: Record<string, unknown>) => number;
};

/* Security Scan Rule — plugged into the security scanner engine. */

/**
 * A declarative security rule attached to a service definition.
 * check() returns true when the security issue IS present.
 */
export type SecurityScanRule = {
  id: string;
  severity: 'high' | 'medium' | 'info';
  title: string;
  /** Called with the node label/id to produce the full description. */
  description: (nodeName: string) => string;
  check: (
    config: Record<string, unknown>,
    node: Node<any>,
    edges: Edge<any>[],
    nodes: Node<any>[],
  ) => boolean;
};

/* AI Hints — fed into the graph context serializer for AI agents. */

export type AIHints = {
  /** One-sentence summary of this resource for AI context. */
  summary: string;
  /** The infrastructure role this resource plays. */
  role: string;
  /** Common use cases in well-designed architectures. */
  useCases: string[];
  /** Config attribute names most relevant for AI reasoning. */
  keyAttributes: string[];
};

/* Deployment Hints — metadata for the deployment pipeline. */

export type DeploymentHints = {
  /** Whether this resource generates real cloud infrastructure. False = logical only. */
  isDeployable: boolean;
  /** True for grouping/boundary nodes that produce no IaC resources. */
  isLogicalOnly?: boolean;
};

/* Service Definition (the core plugin interface). */

export type ServiceDefinition<TConfig = Record<string, unknown>> = {
  id: string;
  cloudFormationType: string;
  name: string;
  shortName: string;
  category: ServiceCategory;
  description: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  accentColor: string;
  capabilities?: {
    provides?: string[];
    requires?: string[];
    optional?: string[];
  };
  allowedParents?: string[];
  requiredParents?: string[];
  forbiddenParents?: string[];
  allowedRelationships?: string[];
  forbiddenRelationships?: string[];
  isContainer?: boolean;

  /* Config lifecycle. */

  createDefaultConfig: (index: number) => TConfig;
  validate: (
    config: TConfig,
    nodes?: any[],
    edges?: any[],
  ) => ServiceValidationErrors;
  getDisplayName: (config: TConfig) => string;

  /* React components. */

  NodeComponent: React.ComponentType<
    NodeProps<{
      serviceId: string;
      label: string;
      config: TConfig;
      validationErrors: ServiceValidationErrors;
    }>
  >;
  InspectorComponent: React.ComponentType<ServiceInspectorProps<TConfig>>;

  /* Plan builder. */

  buildPlanResource: (
    nodeId: string,
    config: TConfig,
    connectionCount: number,
  ) => ServicePlanResource;

  /* Framework extension hooks (all optional — existing services work without them). */

  /** Declarative graph-level validation rules (run by the validation engine). */
  validationRules?: ValidationRule[];

  /** Cost estimation profile (used by the cost estimator engine). */
  costProfile?: CostProfile;

  /** Declarative security scan rules (used by the security scanner engine). */
  securityRules?: SecurityScanRule[];

  /** AI context hints (used by the graph context serializer). */
  aiHints?: AIHints;

  /** Deployment metadata hints. */
  deploymentHints?: DeploymentHints;
};
