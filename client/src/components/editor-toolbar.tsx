import { useRef } from 'react';
import {
  ArrowLeft,
  Grid3x3,
  WandSparkles,
  Rocket,
  Loader2,
  Search,
  MessageSquare,
} from 'lucide-react';
import { formatTimestamp } from '@/utils';

export interface EditorToolbarProps {
  projectName: string;
  onProjectNameChange: (name: string) => void;
  onBack: () => void;
  onSave: () => void;
  onPlan: () => void;
  onDeploy: () => void;
  deploymentStatus: 'idle' | 'pending' | 'in-progress' | 'success' | 'failed';
  lastSavedAt: string | null;
  nodeCount: number;
  readyCount: number;
  snapToGrid: boolean;
  onToggleSnap: () => void;
  isSaving?: boolean;
}

export function EditorToolbar({
  projectName,
  onProjectNameChange,
  onBack,
  onSave,
  onPlan,
  onDeploy,
  deploymentStatus,
  lastSavedAt,
  nodeCount,
  readyCount,
  snapToGrid,
  onToggleSnap,
  isSaving = false,
}: EditorToolbarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isDeploying =
    deploymentStatus === 'pending' || deploymentStatus === 'in-progress';

  return (
    <header
      className="flex h-11 shrink-0 items-center justify-between border-b px-2"
      style={{
        background: 'var(--color-bg-surface)',
        borderColor: 'var(--color-border)',
      }}
    >
      {/* ── LEFT: Back + Title + Name + Save status ── */}
      <div className="flex min-w-0 items-center gap-1">
        <button
          onClick={onBack}
          aria-label="Back to dashboard"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-bg-hover)]"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <ArrowLeft size={16} />
        </button>

        <span
          className="hidden text-[14px] font-bold tracking-tight select-none px-1.5 sm:inline-block"
          style={{
            color: 'var(--color-text-primary)',
            fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}
        >
          Orqestra
        </span>

        {/* Divider */}
        <div
          className="mx-1 h-4 w-px shrink-0"
          style={{ background: 'var(--color-border)' }}
        />

        <input
          ref={inputRef}
          type="text"
          value={projectName}
          onChange={(e) => onProjectNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') inputRef.current?.blur();
          }}
          onBlur={onSave}
          className="min-w-[80px] max-w-[200px] truncate rounded bg-transparent px-1.5 py-0.5 text-[13px] font-medium outline-none transition-all focus:max-w-[280px] focus:ring-1 focus:ring-[var(--color-accent)]"
          style={{ color: 'var(--color-text-primary)' }}
          spellCheck={false}
        />

        <span
          className="hidden shrink-0 whitespace-nowrap text-[11px] sm:inline-block"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {isSaving ? (
            <span className="flex items-center gap-1" style={{ color: 'var(--color-accent)' }}>
              <Loader2 size={10} className="animate-spin" />
              Saving…
            </span>
          ) : lastSavedAt ? (
            `Saved ${formatTimestamp(lastSavedAt)}`
          ) : (
            'Unsaved'
          )}
        </span>
      </div>

      {/* ── CENTER: Node count + status pill ── */}
      <div className="flex items-center gap-1.5">
        <span
          className="rounded-full px-2 py-[2px] text-[11px] font-medium"
          style={{
            background: 'var(--color-accent-subtle)',
            color: 'var(--color-accent)',
          }}
        >
          {nodeCount} node{nodeCount !== 1 ? 's' : ''}
        </span>

        <span
          className="hidden text-[11px] sm:inline-block"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {readyCount}/{nodeCount} ready
        </span>
      </div>

      {/* ── RIGHT: Icon actions + Plan + Deploy ── */}
      <div className="flex items-center gap-0.5">
        {/* Snap to Grid */}
        <button
          onClick={onToggleSnap}
          aria-label="Toggle snap to grid"
          className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-bg-hover)]"
          style={{
            color: snapToGrid
              ? 'var(--color-accent)'
              : 'var(--color-text-muted)',
            background: snapToGrid ? 'var(--color-accent-subtle)' : undefined,
          }}
        >
          <Grid3x3 size={15} />
        </button>

        {/* Search (decorative placeholder) */}
        <button
          aria-label="Search"
          className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-bg-hover)]"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <Search size={15} />
        </button>

        {/* Feedback (decorative placeholder) */}
        <button
          aria-label="Feedback"
          className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-bg-hover)]"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <MessageSquare size={15} />
        </button>

        {/* Divider */}
        <div
          className="mx-1 h-4 w-px shrink-0"
          style={{ background: 'var(--color-border)' }}
        />

        {/* Plan */}
        <button
          onClick={onPlan}
          className="flex items-center gap-1 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors hover:bg-[var(--color-bg-hover)]"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <WandSparkles size={13} />
          <span className="hidden sm:inline">Plan</span>
        </button>

        {/* Deploy — primary CTA */}
        <button
          onClick={onDeploy}
          disabled={isDeploying}
          className="flex items-center gap-1.5 rounded-md px-3 py-1 text-[12px] font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            background: 'var(--color-success)',
          }}
        >
          {isDeploying ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Rocket size={13} />
          )}
          <span className="hidden sm:inline">
            {isDeploying ? 'Deploying…' : 'Deploy'}
          </span>
        </button>
      </div>
    </header>
  );
}
