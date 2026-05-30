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

import { formatTimestamp, hasValidationErrors } from '@/utils';
import { Button, Badge } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useAppDispatch, useAppSelector } from '@/store';
import { setProjectName, setSnapToGrid } from '@/store/editor-slice';
import { DeploymentStatus } from '@/types';

export type EditorToolbarProps = {
  onBack: () => void;
  onSave: () => void;
  onPlan: () => void;
  onDeploy: () => void;
  isSaving?: boolean;
};

export function EditorToolbar({
  onBack,
  onSave,
  onPlan,
  onDeploy,
  isSaving = false,
}: EditorToolbarProps) {
  const dispatch = useAppDispatch();
  const inputRef = useRef<HTMLInputElement>(null);

  const { projectName, lastSavedAt, snapToGrid, nodes } = useAppSelector(
    (state) => state.editor,
  );
  const deploymentStatus = useAppSelector(
    (state) => state.deployment.result.status,
  );

  const isDeploying =
    deploymentStatus === DeploymentStatus.Pending ||
    deploymentStatus === DeploymentStatus.InProgress;

  const nodeCount = nodes.length;
  const invalidNodeCount = nodes.filter((node) =>
    hasValidationErrors(node.data.validationErrors),
  ).length;
  const readyCount = nodeCount - invalidNodeCount;

  return (
    <header className="flex h-11 shrink-0 items-center justify-between border-b border-border bg-card/90 px-3 backdrop-blur-sm">
      {/* LEFT: Back + Title + Name + Save status */}
      <div className="flex min-w-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          aria-label="Back to dashboard"
          className="size-8 shrink-0 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft size={16} />
        </Button>

        <span className="hidden select-none px-1.5 font-sans text-sm font-bold tracking-tight text-foreground sm:inline-block">
          Orqestra
        </span>

        {/* Divider */}
        <div className="mx-1 h-4 w-px shrink-0 bg-border" />

        <input
          ref={inputRef}
          type="text"
          value={projectName}
          onChange={(e) => dispatch(setProjectName(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') inputRef.current?.blur();
          }}
          onBlur={onSave}
          className="min-w-[80px] max-w-[200px] truncate rounded bg-transparent px-1.5 py-0.5 text-xs font-medium text-foreground outline-none transition-all focus:max-w-[280px] focus:ring-1 focus:ring-primary"
          spellCheck={false}
        />

        <span className="hidden shrink-0 whitespace-nowrap text-[11px] text-muted-foreground sm:inline-block">
          {isSaving ? (
            <span className="flex animate-pulse items-center gap-1 text-primary">
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

      {/* CENTER: Node count + status pill */}
      <div className="flex items-center gap-1.5">
        <Badge
          variant="accent"
          className="rounded-full px-2 py-[2px] text-[10px] font-medium"
        >
          {nodeCount} node{nodeCount !== 1 ? 's' : ''}
        </Badge>

        <span className="hidden text-[11px] text-muted-foreground sm:inline-block">
          {readyCount}/{nodeCount} ready
        </span>
      </div>

      {/* RIGHT: Icon actions + Plan + Deploy */}
      <div className="flex items-center gap-0.5">
        {/* Snap to Grid */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => dispatch(setSnapToGrid(!snapToGrid))}
          aria-label="Toggle snap to grid"
          className={cn(
            'h-8 w-8 text-muted-foreground transition-all duration-200',
            snapToGrid &&
            'bg-accent/20 text-primary hover:bg-accent/30 hover:text-primary',
          )}
        >
          <Grid3x3 size={15} />
        </Button>

        {/* Search */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Search"
          className="size-8 text-muted-foreground"
        >
          <Search size={15} />
        </Button>

        {/* Feedback */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Feedback"
          className="size-8 text-muted-foreground"
        >
          <MessageSquare size={15} />
        </Button>

        {/* Divider */}
        <div className="mx-1 h-4 w-px shrink-0 bg-border" />

        {/* Plan */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onPlan}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <WandSparkles size={13} />
          <span className="hidden sm:inline">Plan</span>
        </Button>

        <Button
          onClick={onDeploy}
          disabled={isDeploying}
          size="sm"
          className="flex items-center gap-1.5 font-semibold text-white shadow-sm disabled:opacity-60"
        >
          {isDeploying ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Rocket size={13} />
          )}
          <span className="hidden sm:inline">
            {isDeploying ? 'Deploying…' : 'Deploy'}
          </span>
        </Button>
      </div>
    </header>
  );
}
