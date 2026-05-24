import { Copy, Trash2 } from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function ContextMenu({ x, y, onDuplicate, onDelete }: ContextMenuProps) {
  return (
    <div
      className="glass animate-scale-in fixed z-50 min-w-[180px] overflow-hidden rounded-[var(--radius-lg)] p-1 shadow-[var(--shadow-lg)]"
      style={{ left: x, top: y }}
    >
      <button
        onClick={onDuplicate}
        className="duration-[var(--transition-fast)] flex w-full items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium transition-colors hover:bg-[var(--color-bg-hover)]"
        style={{ color: 'var(--color-text-primary)' }}
      >
        <Copy size={15} className="text-[var(--color-text-secondary)]" />
        Duplicate node
      </button>

      <button
        onClick={onDelete}
        className="duration-[var(--transition-fast)] flex w-full items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium transition-colors hover:bg-[var(--color-bg-hover)]"
        style={{ color: 'var(--color-error)' }}
      >
        <Trash2 size={15} />
        Delete node
      </button>
    </div>
  );
}
