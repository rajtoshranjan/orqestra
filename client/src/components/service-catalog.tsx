import { ChevronLeft, ChevronRight, GripVertical } from 'lucide-react';
import { registry } from '@/services';
import { NODE_DRAG_TYPE } from '@/utils';
import { SERVICE_CATEGORY_LABELS } from '@/services/types';
import type { ServiceCategory } from '@/services/types';

export interface ServiceCatalogProps {
  onAddNode: (serviceId: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function ServiceCatalog({
  onAddNode,
  collapsed,
  onToggleCollapse,
}: ServiceCatalogProps) {
  const servicesByCategory = registry.getByCategory();

  return (
    <aside
      className="duration-[var(--transition-base)] flex h-full shrink-0 flex-col overflow-hidden border-r border-[var(--color-border)] bg-[var(--color-bg-surface)] transition-all"
      style={{ width: collapsed ? 52 : 260 }}
    >
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--color-border)] px-3">
        {!collapsed && (
          <span className="animate-fade-in whitespace-nowrap text-sm font-semibold text-[var(--color-text-primary)]">
            Services
          </span>
        )}
        <button
          onClick={onToggleCollapse}
          className="duration-[var(--transition-fast)] ml-auto rounded-[var(--radius-sm)] p-1.5 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
          aria-label={collapsed ? 'Expand catalog' : 'Collapse catalog'}
        >
          {collapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <ChevronLeft className="size-4" />
          )}
        </button>
      </div>

      {/* Service List — grouped by category */}
      <div className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-2">
        {[...servicesByCategory.entries()].map(([category, services]) => (
          <div key={category}>
            {/* Category header (only when expanded and >1 category) */}
            {!collapsed && servicesByCategory.size > 1 && (
              <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                {SERVICE_CATEGORY_LABELS[category as ServiceCategory]}
              </p>
            )}

            <div className="space-y-2">
              {services.map((service) => {
                const ServiceIcon = service.icon;

                return collapsed ? (
                  /* Collapsed: icon-only */
                  <button
                    key={service.id}
                    onClick={() => onAddNode(service.id)}
                    className="duration-[var(--transition-fast)] mx-auto flex size-9 items-center justify-center rounded-[var(--radius-sm)] transition-colors"
                    style={{
                      background: `${service.accentColor}18`,
                      color: service.accentColor,
                    }}
                    title={service.name}
                  >
                    <ServiceIcon size={16} />
                  </button>
                ) : (
                  /* Expanded: full card */
                  <div
                    key={service.id}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData(NODE_DRAG_TYPE, service.id);
                      event.dataTransfer.effectAllowed = 'copy';
                    }}
                    onClick={() => onAddNode(service.id)}
                    className="duration-[var(--transition-base)] animate-fade-in group cursor-grab select-none rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] active:cursor-grabbing"
                    style={{
                      ['--hover-border' as string]: service.accentColor,
                    }}
                  >
                    {/* Icon + Title Row */}
                    <div className="mb-2 flex items-center gap-2.5">
                      <div
                        className="flex size-8 shrink-0 items-center justify-center rounded-full"
                        style={{
                          background: `${service.accentColor}18`,
                          color: service.accentColor,
                        }}
                      >
                        <ServiceIcon size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                          {service.name}
                        </p>
                      </div>
                      <span
                        className="whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{
                          background: `${service.accentColor}18`,
                          color: service.accentColor,
                        }}
                      >
                        {SERVICE_CATEGORY_LABELS[service.category]}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="mb-2.5 text-xs leading-relaxed text-[var(--color-text-muted)]">
                      {service.description}
                    </p>

                    {/* Drag hint */}
                    <div className="duration-[var(--transition-fast)] flex items-center gap-1 text-[10px] text-[var(--color-text-muted)] opacity-0 transition-opacity group-hover:opacity-100">
                      <GripVertical className="size-3" />
                      <span>Drag to canvas</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
