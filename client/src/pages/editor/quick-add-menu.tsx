import { useState, useEffect, useRef, useMemo } from 'react';
import { Search } from 'lucide-react';
import { registry } from '@/services';
import { SERVICE_CATEGORY_LABELS } from '@/services/types';

type QuickAddMenuProps = {
  x: number;
  y: number;
  onAddNode: (serviceId: string) => void;
  onClose: () => void;
};

export function QuickAddMenu({ x, y, onAddNode, onClose }: QuickAddMenuProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const services = useMemo(() => registry.getAll(), []);

  const filteredServices = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return services;
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.description.toLowerCase().includes(term) ||
        SERVICE_CATEGORY_LABELS[s.category].toLowerCase().includes(term),
    );
  }, [searchTerm, services]);

  // Adjust selection if search list shrinks
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredServices.length]);

  // Auto-focus input on mount
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
      className="glass animate-scale-in fixed z-50 flex w-[260px] flex-col overflow-hidden rounded-lg border border-border/80 bg-popover shadow-xl"
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
      <div className="max-h-[220px] overflow-y-auto p-1">
        {filteredServices.map((service, index) => {
          const ServiceIcon = service.icon;
          const isSelected = index === selectedIndex;

          return (
            <button
              key={service.id}
              onClick={() => {
                onAddNode(service.id);
                onClose();
              }}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-xs transition-colors duration-150 ${
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
              <div className="flex min-w-0 flex-col">
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
    </div>
  );
}
