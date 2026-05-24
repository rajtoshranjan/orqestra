import { useRef } from 'react';
import {
  ArrowLeft,
  Grid3x3,
  WandSparkles,
  Rocket,
  Loader2,
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
      className="flex h-12 items-center justify-between border-b px-3"
      style={{
        background: 'var(--color-bg-surface)',
        borderColor: 'var(--color-border)',
      }}
    >
      {/* ── LEFT ── */}
      <div className="flex min-w-0 items-center gap-2">
        <button
          onClick={onBack}
          aria-label="Back to dashboard"
          className="duration-[var(--transition-fast)] flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] transition-colors hover:bg-[var(--color-bg-hover)]"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <ArrowLeft size={18} />
        </button>

        <input
          ref={inputRef}
          type="text"
          value={projectName}
          onChange={(e) => onProjectNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') inputRef.current?.blur();
          }}
          onBlur={onSave}
          className="duration-[var(--transition-fast)] min-w-[80px] max-w-[220px] truncate rounded bg-transparent px-1.5 py-0.5 text-sm font-bold outline-none transition-all focus:max-w-[320px] focus:ring-1 focus:ring-[var(--color-accent)]"
          style={{ color: 'var(--color-text-primary)' }}
          spellCheck={false}
        />

        <span
          className="hidden whitespace-nowrap text-[11px] sm:inline-block"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {isSaving ? (
            <span className="flex items-center gap-1 text-violet-400">
              <Loader2 size={11} className="animate-spin" />
              Saving...
            </span>
          ) : lastSavedAt ? (
            `Saved ${formatTimestamp(lastSavedAt)}`
          ) : (
            'Unsaved'
          )}
        </span>
      </div>

      {/* ── CENTER ── */}
      <div className="flex items-center gap-2">
        <span
          className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
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

        <button
          onClick={onToggleSnap}
          aria-label="Toggle snap to grid"
          className="duration-[var(--transition-fast)] flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] transition-colors hover:bg-[var(--color-bg-hover)]"
          style={{
            color: snapToGrid
              ? 'var(--color-accent)'
              : 'var(--color-text-muted)',
            background: snapToGrid ? 'var(--color-accent-subtle)' : undefined,
          }}
        >
          <Grid3x3 size={16} />
        </button>
      </div>

      {/* ── RIGHT ── */}
      <div className="flex items-center gap-2">
        <button
          onClick={onPlan}
          className="duration-[var(--transition-fast)] flex items-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-semibold transition-all hover:bg-[var(--color-bg-hover)]"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <WandSparkles size={14} />
          <span className="hidden sm:inline">Plan</span>
        </button>

        <button
          onClick={onDeploy}
          disabled={isDeploying}
          className="glow-accent duration-[var(--transition-fast)] flex items-center gap-1.5 rounded-[var(--radius-sm)] px-4 py-1.5 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            background: 'var(--color-accent)',
            color: '#fff',
          }}
        >
          {isDeploying ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Rocket size={14} />
          )}
          <span className="hidden sm:inline">
            {isDeploying ? 'Deploying…' : 'Deploy'}
          </span>
        </button>
      </div>
    </header>
  );
}
