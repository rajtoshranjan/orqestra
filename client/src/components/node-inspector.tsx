import { MousePointer2 } from 'lucide-react';

import type { DiagramNode } from '@/types';
import { registry } from '@/services';
import { Badge, EmptyState } from '@/components/ui';

export type NodeInspectorProps = {
  selectedNode: DiagramNode | null;
  onUpdateConfig: (
    updater: (config: Record<string, unknown>) => Record<string, unknown>,
  ) => void;
};

export function NodeInspector({
  selectedNode,
  onUpdateConfig,
}: NodeInspectorProps) {
  /* Empty state. */
  if (!selectedNode) {
    return (
      <aside className="animate-slide-in-right flex h-full w-[360px] shrink-0 flex-col justify-center border-l border-border bg-card">
        <EmptyState
          title="No node selected"
          description="Select any cloud resource on the canvas to inspect and configure its settings."
          icon={MousePointer2}
          className="px-6"
        />
      </aside>
    );
  }

  const { serviceId, config, validationErrors } = selectedNode.data;

  /* Look up the service definition. */
  const service = registry.find(serviceId);
  if (!service) {
    return (
      <aside className="flex h-full w-[360px] shrink-0 flex-col justify-center border-l border-border bg-card">
        <EmptyState
          title="Unknown service"
          description={`The service type "${serviceId}" is not registered in this system.`}
          icon={MousePointer2}
          className="px-6"
        />
      </aside>
    );
  }

  const hasErrors = Object.values(validationErrors).some(Boolean);
  const ServiceIcon = service.icon;
  const InspectorForm = service.InspectorComponent;

  return (
    <aside className="animate-slide-in-right flex h-full w-[360px] shrink-0 flex-col border-l border-border bg-card">
      {/* Header. */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
        <div
          className="flex size-8 items-center justify-center rounded-full text-primary"
          style={{ background: `${service.accentColor}18` }}
        >
          <ServiceIcon size={16} className="text-primary" />
        </div>
        <span className="text-sm font-semibold text-foreground">
          {service.name}
        </span>
        <Badge
          variant={hasErrors ? 'warning' : 'success'}
          className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium"
        >
          {hasErrors ? 'Needs attention' : 'Valid'}
        </Badge>
      </div>

      {/* Service-specific form (rendered via registry). */}
      <div className="flex-1 overflow-y-auto p-4">
        <InspectorForm
          config={config}
          validationErrors={validationErrors}
          onUpdate={(updater) => onUpdateConfig(updater)}
        />
      </div>
    </aside>
  );
}
