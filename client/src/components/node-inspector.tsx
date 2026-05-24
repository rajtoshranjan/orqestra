import { MousePointer2 } from 'lucide-react';
import type { DiagramNode } from '@/types';
import { registry } from '@/services';

export interface NodeInspectorProps {
  selectedNode: DiagramNode | null;
  onUpdateConfig: (
    updater: (config: Record<string, unknown>) => Record<string, unknown>,
  ) => void;
}

export function NodeInspector({
  selectedNode,
  onUpdateConfig,
}: NodeInspectorProps) {
  /* ─── Empty state ──────────────────────────────────────────── */
  if (!selectedNode) {
    return (
      <aside className="animate-slide-in-right flex h-full w-[360px] shrink-0 flex-col items-center justify-center gap-3 border-l border-[var(--color-border)] bg-[var(--color-bg-surface)]">
        <MousePointer2 className="h-8 w-8 text-[var(--color-text-muted)]" />
        <p className="text-sm text-[var(--color-text-muted)]">
          Select a node to inspect
        </p>
      </aside>
    );
  }

  const { serviceId, config, validationErrors } = selectedNode.data;

  /* ── Look up the service definition ──────────────────────── */
  const service = registry.find(serviceId);
  if (!service) {
    return (
      <aside className="flex h-full w-[360px] shrink-0 flex-col items-center justify-center gap-3 border-l border-[var(--color-border)] bg-[var(--color-bg-surface)]">
        <p className="text-sm text-[var(--color-text-muted)]">
          Unknown service: {serviceId}
        </p>
      </aside>
    );
  }

  const hasErrors = Object.values(validationErrors).some(Boolean);
  const ServiceIcon = service.icon;
  const InspectorForm = service.InspectorComponent;

  return (
    <aside className="animate-slide-in-right flex h-full w-[360px] shrink-0 flex-col border-l border-[var(--color-border)] bg-[var(--color-bg-surface)]">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--color-border)] px-4 py-3">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full"
          style={{ background: `${service.accentColor}18` }}
        >
          <ServiceIcon size={16} className="text-[var(--color-cyan)]" />
        </div>
        <span className="text-sm font-semibold text-[var(--color-text-primary)]">
          {service.name}
        </span>
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium ${
            hasErrors
              ? 'bg-[var(--color-warning-subtle)] text-[var(--color-warning)]'
              : 'bg-[var(--color-success-subtle)] text-[var(--color-success)]'
          }`}
        >
          {hasErrors ? 'Needs attention' : 'Valid'}
        </span>
      </div>

      {/* ─── Service-specific form (rendered via registry) ──────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <InspectorForm
          config={config}
          validationErrors={validationErrors}
          onUpdate={onUpdateConfig as any}
        />
      </div>
    </aside>
  );
}
