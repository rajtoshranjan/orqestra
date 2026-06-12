import { useState, useEffect, useRef, useMemo } from 'react';

import { Search } from 'lucide-react';

import { registry } from '@/services';
import { SERVICE_CATEGORY_LABELS } from '@/services/types';
import { NODE_DRAG_TYPE } from '@/utils';

type QuickAddMenuProps = {
  x: number;
  y: number;
  onAddNode: (serviceId: string) => void;
  onClose: () => void;
};

const SYNONYMS: Record<string, string[]> = {
  database: ['dynamodb', 'rds', 'aurora', 'elasticache', 'opensearch'],
  db: ['dynamodb', 'rds', 'aurora', 'elasticache', 'opensearch'],
  redis: ['elasticache'],
  pubsub: ['sns', 'sqs', 'kinesis'],
  queue: ['sqs'],
  notification: ['sns'],
  broker: ['sqs', 'sns', 'eventbridge'],
  storage: ['s3', 'efs', 'ecr'],
  compute: ['lambda'],
  serverless: ['lambda', 'api-gateway', 'dynamodb'],
  network: ['vpc', 'subnet', 'security-group'],
  gateway: ['api-gateway'],
  router: ['api-gateway', 'eventbridge'],
  flow: ['step-function'],
};

export function QuickAddMenu({ x, y, onAddNode, onClose }: QuickAddMenuProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const services = useMemo(() => registry.getAll(), []);

  const filteredServices = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return services;

    const matchedServiceIdsFromSynonyms = new Set<string>();
    for (const [key, value] of Object.entries(SYNONYMS)) {
      if (key.includes(term) || term.includes(key)) {
        value.forEach((id) => matchedServiceIdsFromSynonyms.add(id));
      }
    }

    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.description.toLowerCase().includes(term) ||
        SERVICE_CATEGORY_LABELS[s.category].toLowerCase().includes(term) ||
        matchedServiceIdsFromSynonyms.has(s.id),
    );
  }, [searchTerm, services]);

  // Adjust selection if search list shrinks.
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredServices.length]);

  // Scroll the active selected item into view.
  useEffect(() => {
    if (listRef.current && filteredServices.length > 0) {
      const selectedElement = listRef.current.children[
        selectedIndex
      ] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, filteredServices.length]);

  // Auto-focus input on mount.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((prev) =>
          filteredServices.length > 0
            ? (prev + 1) % filteredServices.length
            : 0,
        );
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((prev) =>
          filteredServices.length > 0
            ? (prev - 1 + filteredServices.length) % filteredServices.length
            : 0,
        );
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (
          filteredServices.length > 0 &&
          selectedIndex < filteredServices.length
        ) {
          onAddNode(filteredServices[selectedIndex].id);
          onClose();
        }
      } else if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredServices, selectedIndex, onAddNode, onClose]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="glass animate-scale-in fixed z-[2000] flex w-[260px] flex-col overflow-hidden rounded-lg border border-border/85 bg-popover/95 shadow-2xl backdrop-blur-md"
      style={{ left: x, top: y }}
    >
      {/* Search Input */}
      <div className="flex items-center border-b border-border/60 px-2.5 py-2">
        <Search className="mr-2 size-3.5 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Type to search & add..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>

      {/* Services List */}
      <div ref={listRef} className="max-h-[220px] overflow-y-auto p-1">
        {filteredServices.map((service, index) => {
          const ServiceIcon = service.icon;
          const isSelected = index === selectedIndex;

          return (
            <button
              key={service.id}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData(NODE_DRAG_TYPE, service.id);
                event.dataTransfer.effectAllowed = 'copy';
                onClose();
              }}
              onClick={() => {
                onAddNode(service.id);
                onClose();
              }}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-xs transition-colors duration-150 ${
                isSelected
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-accent/40'
              }`}
            >
              <div
                className="flex size-6 shrink-0 items-center justify-center rounded border border-border bg-background"
                style={{ color: service.accentColor }}
              >
                <ServiceIcon size={13} />
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium text-foreground">
                  {service.name}
                </span>
                <span className="truncate text-[9px] text-muted-foreground/80">
                  {SERVICE_CATEGORY_LABELS[service.category]}
                </span>
              </div>
            </button>
          );
        })}

        {filteredServices.length === 0 && (
          <div className="py-6 text-center text-[10px] text-muted-foreground">
            No matching services found
          </div>
        )}
      </div>

      {/* Footer Instructions */}
      <div className="flex select-none items-center justify-between border-t border-border/40 bg-muted/40 px-2.5 py-1 text-[8.5px] text-muted-foreground">
        <span>↑↓ to navigate</span>
        <span>Enter to add</span>
        <span>Drag to canvas</span>
      </div>
    </div>
  );
}
