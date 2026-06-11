import { Copy, MessageSquarePlus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui';

type ContextMenuProps = {
  kind: 'node' | 'pane';
  x: number;
  y: number;
  onAddComment: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
};

export function ContextMenu({
  kind,
  x,
  y,
  onAddComment,
  onDuplicate,
  onDelete,
}: ContextMenuProps) {
  return (
    <div
      className="glass animate-scale-in fixed z-50 min-w-[180px] overflow-hidden rounded-lg border border-border/80 bg-popover p-1 shadow-md"
      style={{ left: x, top: y }}
    >
      <Button
        variant="ghost"
        size="sm"
        type="button"
        onClick={onAddComment}
        className="flex w-full items-center justify-start gap-3 rounded-md px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
      >
        <MessageSquarePlus size={14} className="text-muted-foreground" />
        {kind === 'node' ? 'Add comment' : 'Add comment here'}
      </Button>

      {kind === 'node' && (
        <>
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
        </>
      )}
    </div>
  );
}
