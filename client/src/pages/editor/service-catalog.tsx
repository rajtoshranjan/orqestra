import { useState, useMemo, useEffect, useRef } from 'react';

import { ChevronLeft, ChevronRight, GripVertical, Search } from 'lucide-react';

import { EmptyState } from '@/components/ui';
import { registry } from '@/services';
import { SERVICE_CATEGORY_LABELS } from '@/services/types';
import type { ServiceCategory, ServiceDefinition } from '@/services/types';
import { NODE_DRAG_TYPE } from '@/utils';

interface CustomCSSProperties extends React.CSSProperties {
  '--hover-border'?: string;
}

export type ServiceCatalogProps = {
  onAddNode: (serviceId: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
};

export function ServiceCatalog({
  onAddNode,
  collapsed,
  onToggleCollapse,
}: ServiceCatalogProps) {
  const servicesByCategory = registry.getByCategory();
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!collapsed) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [collapsed]);

  const filteredServicesByCategory = useMemo(() => {
    if (!searchTerm.trim()) return servicesByCategory;

    const lowerSearch = searchTerm.toLowerCase();
    const filtered = new Map<ServiceCategory, ServiceDefinition[]>();

    for (const [category, services] of servicesByCategory.entries()) {
      const matchedServices = services.filter(
        (service) =>
          service.name.toLowerCase().includes(lowerSearch) ||
          service.description.toLowerCase().includes(lowerSearch) ||
          SERVICE_CATEGORY_LABELS[category].toLowerCase().includes(lowerSearch),
      );

      if (matchedServices.length > 0) {
        filtered.set(category, matchedServices);
      }
    }
    return filtered;
  }, [searchTerm, servicesByCategory]);

  return (
    <aside
      className="flex h-full shrink-0 flex-col overflow-hidden border-r border-[var(--color-border)] bg-[var(--color-bg-surface)] transition-all [transition-duration:var(--transition-base)]"
      style={{ width: collapsed ? 52 : 240 }}
    >
      {/* Header. */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--color-border)] px-3">
        {!collapsed && (
          <span className="animate-fade-in whitespace-nowrap text-sm font-semibold text-[var(--color-text-primary)]">
            Services
          </span>
        )}
        <button
          onClick={onToggleCollapse}
          className="ml-auto rounded-[var(--radius-sm)] p-1.5 text-[var(--color-text-secondary)] transition-colors [transition-duration:var(--transition-fast)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
          aria-label={collapsed ? 'Expand catalog' : 'Collapse catalog'}
        >
          {collapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <ChevronLeft className="size-4" />
          )}
        </button>
      </div>

      {/* Search Bar. */}
      {!collapsed && (
        <div className="shrink-0 border-b border-[var(--color-border)] px-3 py-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search services..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] bg-transparent py-1.5 pl-8 pr-2 text-xs text-[var(--color-text-primary)] transition-colors placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            />
          </div>
        </div>
      )}

      {/* Service List — grouped by category. */}
      <div className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-2">
        {[...filteredServicesByCategory.entries()].map(
          ([category, services]) => (
            <div key={category}>
              {/* Category header (only when expanded and >1 category). */}
              {!collapsed && filteredServicesByCategory.size > 1 && (
                <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  {SERVICE_CATEGORY_LABELS[category]}
                </p>
              )}

              <div className="space-y-2">
                {services.map((service) => {
                  const ServiceIcon = service.icon;

                  const collapsedStyle: React.CSSProperties = {
                    background: `${service.accentColor}18`,
                    color: service.accentColor,
                  };

                  const itemStyle: CustomCSSProperties = {
                    '--hover-border': service.accentColor,
                  };

                  return collapsed ? (
                    /* Collapsed: icon-only. */
                    <button
                      key={service.id}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData(NODE_DRAG_TYPE, service.id);
                        event.dataTransfer.effectAllowed = 'copy';
                      }}
                      onDoubleClick={() => onAddNode(service.id)}
                      className="mx-auto flex size-8 cursor-grab items-center justify-center rounded-[var(--radius-sm)] transition-colors [transition-duration:var(--transition-fast)] active:cursor-grabbing"
                      style={collapsedStyle}
                      title={service.name}
                    >
                      <ServiceIcon size={14} />
                    </button>
                  ) : (
                    /* Expanded: node-like card. */
                    <div
                      key={service.id}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData(NODE_DRAG_TYPE, service.id);
                        event.dataTransfer.effectAllowed = 'copy';
                      }}
                      onDoubleClick={() => onAddNode(service.id)}
                      className="animate-fade-in group relative flex min-h-[56px] cursor-grab select-none items-center gap-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-2.5 shadow-sm backdrop-blur-md transition-all [transition-duration:var(--transition-base)] hover:-translate-y-px hover:border-[var(--hover-border)] hover:shadow-md active:cursor-grabbing"
                      style={itemStyle}
                      title={service.description}
                    >
                      {/* Left Column: Service Icon Container */}
                      <div
                        className="flex size-9 shrink-0 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg-base)] transition-colors group-hover:bg-[var(--color-bg-hover)]"
                        style={{ color: service.accentColor }}
                      >
                        <ServiceIcon size={18} />
                      </div>

                      {/* Middle Column: Resource Labels */}
                      <div className="flex min-w-0 flex-1 flex-col justify-center text-left">
                        <p className="mb-0.5 text-[9px] font-bold uppercase leading-none tracking-wider text-[var(--color-text-muted)]">
                          {SERVICE_CATEGORY_LABELS[service.category]}
                        </p>
                        <p className="truncate text-xs font-semibold leading-tight tracking-tight text-[var(--color-text-primary)]">
                          {service.name}
                        </p>
                      </div>

                      {/* Drag hint on hover */}
                      <div className="flex items-center text-[var(--color-text-muted)] opacity-0 transition-opacity group-hover:opacity-100">
                        <GripVertical size={14} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ),
        )}

        {/* Empty State for Search */}
        {!collapsed && filteredServicesByCategory.size === 0 && (
          <EmptyState
            icon={Search}
            title=" No services found"
            description={`We couldn't find any services matching "${searchTerm}"`}
            size="sm"
          />
        )}
      </div>
    </aside>
  );
}
