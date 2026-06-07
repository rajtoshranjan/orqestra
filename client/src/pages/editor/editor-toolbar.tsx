import {
  ArrowLeft,
  Grid3x3,
  Loader2,
  Lock,
  PencilLine,
  Rocket,
  Sparkles,
  Unlock,
} from 'lucide-react';
import React from 'react';

import {
  Badge,
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui';
import { ProjectSettingsModal } from '@/pages/editor/project-settings-modal';
import { cn } from '@/lib/utils';
import { useAppDispatch, useAppSelector } from '@/store';
import { setIsLocked, setSnapToGrid } from '@/store/editor-slice';
import { DeploymentStatus } from '@/types';
import type { DiagramNode } from '@/types';
import { formatRelativeTime, hasValidationErrors } from '@/utils';

/**
 * Derives toolbar-relevant node counts from the Redux nodes array.
 * Returns a stable reference when counts haven't changed, preventing
 * unnecessary toolbar re-renders during drag operations.
 */
const selectNodeCounts = (nodes: DiagramNode[]) => {
  const nodeCount = nodes.length;
  const invalidNodeCount = nodes.filter((node) =>
    hasValidationErrors(node.data.validationErrors),
  ).length;
  return { nodeCount, invalidNodeCount };
};

export type EditorToolbarProps = {
  onBack: () => void;
  onPlan: () => void;
  onAutoLayout?: () => void;
  isSaving?: boolean;
  deploymentStatus: DeploymentStatus;
};

function EditorToolbarComponent({
  onBack,
  onPlan,
  onAutoLayout,
  isSaving = false,
  deploymentStatus,
}: EditorToolbarProps) {
  const dispatch = useAppDispatch();
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  const { projectName, lastSavedAt, snapToGrid, isLocked } = useAppSelector(
    (state) => ({
      projectName: state.editor.projectName,
      lastSavedAt: state.editor.lastSavedAt,
      snapToGrid: state.editor.snapToGrid,
      isLocked: state.editor.isLocked,
    }),
    (prev, next) =>
      prev.projectName === next.projectName &&
      prev.lastSavedAt === next.lastSavedAt &&
      prev.snapToGrid === next.snapToGrid &&
      prev.isLocked === next.isLocked,
  );

  const { nodeCount, invalidNodeCount } = useAppSelector(
    (state) => {
      const counts = selectNodeCounts(state.editor.nodes);
      return counts;
    },
    (prev, next) =>
      prev.nodeCount === next.nodeCount &&
      prev.invalidNodeCount === next.invalidNodeCount,
  );

  const isDeploying =
    deploymentStatus === DeploymentStatus.Pending ||
    deploymentStatus === DeploymentStatus.InProgress;

  const readyCount = nodeCount - invalidNodeCount;

  return (
    <TooltipProvider delayDuration={300}>
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-border bg-card/90 px-3 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            aria-label="Back to Project"
            className="size-8 shrink-0 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft size={16} />
          </Button>

          <span className="hidden select-none px-1.5 font-sans text-sm font-bold tracking-tight text-foreground sm:inline-block">
            Orqestra
          </span>

          {/* Divider */}
          <div className="mx-1 h-4 w-px shrink-0 bg-border" />
          <div className="flex items-center">
            <span className="max-w-[200px] truncate px-1 py-0.5 text-xs font-medium text-foreground">
              {projectName || 'Untitled Project'}
            </span>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSettingsOpen(true)}
                  className="size-5 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <PencilLine size={11} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Edit Project Info
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* CENTER: Node count + status pill + Saved status */}
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

          <span className="hidden text-[11px] text-muted-foreground/40 sm:inline-block">
            •
          </span>

          <span className="hidden shrink-0 whitespace-nowrap text-[11px] text-muted-foreground sm:inline-block">
            {isSaving ? (
              <span className="flex animate-pulse items-center gap-1 text-primary">
                <Loader2 size={10} className="animate-spin" />
                Saving…
              </span>
            ) : lastSavedAt ? (
              `Saved ${formatRelativeTime(lastSavedAt)}`
            ) : (
              'Unsaved'
            )}
          </span>
        </div>

        {/* RIGHT: Icon actions + Plan + Deploy */}
        <div className="flex items-center gap-0.5">
          {/* Lock/Unlock Editor */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => dispatch(setIsLocked(!isLocked))}
                aria-label={isLocked ? 'Unlock editor' : 'Lock editor'}
                className={cn(
                  'h-8 w-8 text-muted-foreground transition-all duration-200',
                  isLocked &&
                    'bg-warning/20 text-warning hover:bg-warning/30 hover:text-warning',
                )}
              >
                {isLocked ? <Lock size={15} /> : <Unlock size={15} />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {isLocked ? 'Unlock editor' : 'Lock editor'}
            </TooltipContent>
          </Tooltip>

          {/* Snap to Grid */}
          <Tooltip>
            <TooltipTrigger asChild>
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
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Toggle snap to grid
            </TooltipContent>
          </Tooltip>

          {/* Auto Layout */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onAutoLayout}
                aria-label="Auto layout diagram"
                className="size-8 text-muted-foreground transition-all duration-200 hover:bg-accent/20 hover:text-primary"
              >
                <Sparkles size={15} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Auto layout diagram (Alt+L)
            </TooltipContent>
          </Tooltip>

          {/* Divider */}
          <div className="mx-1 h-4 w-px shrink-0 bg-border" />

          {/* Plan & Deploy */}
          <Button
            onClick={onPlan}
            size="sm"
            className="flex items-center gap-1.5 font-semibold text-white shadow-sm"
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

      <ProjectSettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
    </TooltipProvider>
  );
}

export const EditorToolbar = React.memo(EditorToolbarComponent);
