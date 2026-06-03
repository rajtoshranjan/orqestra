import type { NodeProps } from 'reactflow';

/* Service Categories. */

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

  /* Config lifecycle. */

  createDefaultConfig: (index: number) => TConfig;
  validate: (config: TConfig) => ServiceValidationErrors;
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
};
