import { Copy, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui';

type ContextMenuProps = {
  x: number;
  y: number;
  onDuplicate: () => void;
  onDelete: () => void;
};

export function ContextMenu({ x, y, onDuplicate, onDelete }: ContextMenuProps) {
  return (
    <div
      className="glass animate-scale-in fixed z-50 min-w-[180px] overflow-hidden rounded-lg border border-border/80 bg-popover p-1 shadow-md"
      style={{ left: x, top: y }}
    >
      <Button
        variant="ghost"
        size="sm"
        type="button"
        onClick={onDuplicate}
        className="flex w-full items-center justify-start gap-3 rounded-md px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
      >
        <Copy size={14} className="text-muted-foreground" />
        Duplicate node
      </Button>

      <Button
        variant="ghost"
        size="sm"
        type="button"
        onClick={onDelete}
        className="flex w-full items-center justify-start gap-3 rounded-md px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 size={14} />
        Delete node
      </Button>
    </div>
  );
}
