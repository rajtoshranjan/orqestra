import type { CanvasShortcut } from './canvas-utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui';

type CanvasShortcutsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcuts: CanvasShortcut[];
};

const CATEGORY_LABELS: Record<string, string> = {
  general: 'General Actions',
  canvas: 'Canvas Controls',
  view: 'View Options',
  edit: 'Editing Tools',
};

export function CanvasShortcutsDialog({
  open,
  onOpenChange,
  shortcuts,
}: CanvasShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-[var(--color-bg-surface)] text-foreground sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-foreground">
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2 text-xs">
          {(['general', 'canvas', 'view', 'edit'] as const).map((cat) => {
            const catShortcuts = shortcuts.filter(
              (s) => s.category === cat && s.key !== 'Backspace',
            );
            if (catShortcuts.length === 0) return null;

            return (
              <div key={cat} className="space-y-2">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {CATEGORY_LABELS[cat]}
                </h4>
                <div className="space-y-1.5">
                  {catShortcuts.map((shortcut) => {
                    const displayKeys: string[] = [];
                    if (shortcut.meta) displayKeys.push('⌘');
                    if (shortcut.alt) displayKeys.push('⌥');
                    if (shortcut.shift) displayKeys.push('⇧');
                    displayKeys.push(
                      shortcut.key === ' ' ? 'Space' : shortcut.key,
                    );

                    return (
                      <div
                        key={
                          shortcut.key +
                          (shortcut.meta ? 'm' : '') +
                          (shortcut.alt ? 'a' : '')
                        }
                        className="flex items-center justify-between border-b border-border/20 py-1 last:border-0"
                      >
                        <span className="text-[11px] text-muted-foreground">
                          {shortcut.description}
                        </span>
                        <div className="flex gap-0.5">
                          {displayKeys.map((k, idx) => (
                            <kbd
                              key={idx}
                              className="rounded border border-border/80 bg-muted px-1.5 py-0.5 font-mono text-[9px] font-bold text-foreground shadow-sm"
                            >
                              {k}
                            </kbd>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
