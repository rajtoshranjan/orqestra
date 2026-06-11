import {
  ArrowLeft,
  Grid3x3,
  Loader2,
  Lock,
  MessageSquare,
  PencilLine,
  Rocket,
  Sparkles,
  Unlock,
  HelpCircle,
  ChevronDown,
  Cloud,
  CloudOff,
} from 'lucide-react';
import React from 'react';

import {
  Badge,
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  Popover,
  PopoverTrigger,
  PopoverContent,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui';
import { ProjectSettingsModal } from '@/pages/editor/project-settings-modal';
import { ProjectNotificationsBell } from '@/pages/editor/comments/notifications-bell';
import { cn } from '@/lib/utils';
import { useAppDispatch, useAppSelector } from '@/store';
import { setIsLocked, setSnapToGrid } from '@/store/editor-slice';
import { setProjectSettingsOpen } from '@/store/ui-slice';
import { DeploymentStatus } from '@/types';
import type { DiagramNode } from '@/types';
import { formatRelativeTime, hasValidationErrors } from '@/utils';
import { registry } from '@/services';

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
  onSelectNode?: (nodeId: string) => void;
  onHelp?: () => void;
  onClearCanvas?: () => void;
  commentMode?: boolean;
  onToggleCommentMode?: () => void;
  onOpenAnnotation?: (annotationId: string, projectId: string) => void;
};

function EditorToolbarComponent({
  onBack,
  onPlan,
  onAutoLayout,
  isSaving = false,
  deploymentStatus,
  onSelectNode,
  onHelp,
  onClearCanvas,
  commentMode = false,
  onToggleCommentMode,
  onOpenAnnotation,
}: EditorToolbarProps) {
  const dispatch = useAppDispatch();

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

  const projectSettingsOpen = useAppSelector(
    (state) => state.ui.projectSettingsOpen,
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

  const invalidNodes = useAppSelector((state) =>
    state.editor.nodes.filter((node) =>
      hasValidationErrors(node.data.validationErrors),
    ),
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
                  onClick={() => dispatch(setProjectSettingsOpen(true))}
                  className="size-5 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <PencilLine size={11} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Edit Project Info
              </TooltipContent>
            </Tooltip>

            {/* Save Status Icon */}
            {isSaving ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="ml-1.5 flex cursor-default items-center text-primary">
                    <Loader2 size={12} className="animate-spin" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Saving changes…
                </TooltipContent>
              </Tooltip>
            ) : lastSavedAt ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="ml-1.5 flex cursor-default items-center text-success">
                    <Cloud size={12} />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Saved {formatRelativeTime(lastSavedAt)} (
                  {new Date(lastSavedAt).toLocaleString()})
                </TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="ml-1.5 flex cursor-default items-center text-muted-foreground">
                    <CloudOff size={12} className="opacity-60" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Unsaved changes
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* CENTER: Status pill + Saved status */}
        <div className="flex items-center gap-1.5">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold outline-none transition-all',
                  invalidNodeCount > 0
                    ? 'cursor-pointer border-warning/20 bg-warning/10 text-warning shadow-sm shadow-warning/5 hover:bg-warning/20'
                    : 'cursor-default border-success/20 bg-success/10 text-success',
                )}
              >
                <span
                  className={cn(
                    'size-1.5 rounded-full',
                    invalidNodeCount > 0
                      ? 'animate-pulse bg-warning'
                      : 'bg-success',
                  )}
                />
                {readyCount}/{nodeCount} ready
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="center"
              side="bottom"
              className="z-[9999] w-80 border-border bg-[var(--color-bg-surface)] p-3 text-foreground shadow-xl"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                  <span className="text-xs font-bold text-foreground">
                    Validation Findings
                  </span>
                  <Badge
                    variant={invalidNodeCount > 0 ? 'warning' : 'success'}
                    className="px-1.5 py-0 text-[9px]"
                  >
                    {invalidNodeCount > 0
                      ? `${invalidNodeCount} Issue${invalidNodeCount > 1 ? 's' : ''}`
                      : 'Clean'}
                  </Badge>
                </div>

                {invalidNodeCount > 0 ? (
                  <div className="max-h-60 space-y-2.5 overflow-y-auto pr-1">
                    {invalidNodes.map((node) => {
                      const service = registry.find(node.data.serviceId);
                      const errors = Object.entries(node.data.validationErrors)
                        .filter(([, msg]) => Boolean(msg))
                        .map(([, msg]) => msg);

                      return (
                        <div key={node.id} className="space-y-1 text-left">
                          <button
                            onClick={() => onSelectNode?.(node.id)}
                            className="block text-left text-[11px] font-bold text-primary outline-none hover:underline"
                          >
                            {node.data.label}{' '}
                            <span className="text-[9px] font-normal text-muted-foreground">
                              ({service?.shortName || node.data.serviceId})
                            </span>
                          </button>
                          <ul className="list-disc space-y-0.5 pl-4 text-[10px] leading-normal text-muted-foreground">
                            {errors.map((err, idx) => (
                              <li key={idx}>{err}</li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-4 text-center text-xs leading-relaxed text-muted-foreground">
                    No structural or configuration issues detected. Ready for
                    deployment.
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
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
                title={
                  isLocked
                    ? 'Unlock Editor (⌥Shift+L)'
                    : 'Lock Editor (⌥Shift+L)'
                }
              >
                {isLocked ? <Lock size={15} /> : <Unlock size={15} />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {isLocked ? 'Unlock Editor (⌥Shift+L)' : 'Lock Editor (⌥Shift+L)'}
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
                title="Toggle Snap to Grid (⌥G)"
              >
                <Grid3x3 size={15} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Toggle Snap to Grid (⌥G)
            </TooltipContent>
          </Tooltip>

          {/* Comments Sidebar */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleCommentMode}
                aria-label={commentMode ? 'Hide comments' : 'Show comments'}
                aria-pressed={commentMode}
                className={cn(
                  'h-8 w-8 text-muted-foreground transition-all duration-200',
                  commentMode &&
                  'bg-accent/20 text-primary hover:bg-accent/30 hover:text-primary',
                )}
                title="Toggle Comments Panel"
              >
                <MessageSquare size={15} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {commentMode ? 'Hide Comments Panel' : 'Show Comments Panel'}
            </TooltipContent>
          </Tooltip>

          {/* Canvas Actions Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground transition-all duration-200 hover:bg-accent/20 hover:text-primary"
                title="Canvas Actions"
              >
                <ChevronDown size={15} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="z-[9999] w-48 border-border bg-[var(--color-bg-surface)] text-foreground"
            >
              <DropdownMenuItem
                onClick={onAutoLayout}
                className="flex cursor-pointer items-center justify-between text-xs"
              >
                <span>Auto Layout</span>
                <kbd className="rounded border border-border/60 bg-muted px-1.5 text-[9px] opacity-65">
                  ⌥L
                </kbd>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onClearCanvas}
                disabled={isLocked}
                className="cursor-pointer text-xs text-destructive hover:text-destructive/80 focus:text-destructive/80 disabled:opacity-50"
              >
                Clear Canvas
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={onHelp}
                className="flex cursor-pointer items-center justify-between text-xs"
              >
                <span>Keyboard Shortcuts</span>
                <kbd className="rounded border border-border/60 bg-muted px-1.5 text-[9px] opacity-65">
                  ?
                </kbd>
              </DropdownMenuItem>

            </DropdownMenuContent>
          </DropdownMenu>

          {/* Notifications */}
          {onOpenAnnotation && (
            <ProjectNotificationsBell onOpenAnnotation={onOpenAnnotation} />
          )}

          {/* Divider */}
          <div className="mx-1 h-4 w-px shrink-0 bg-border" />

          {/* Plan & Deploy */}
          <Button
            onClick={onPlan}
            size="sm"
            className="flex items-center gap-1.5 font-semibold text-white shadow-sm"
            title="Open Plan & Deploy (⌥D)"
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
        open={projectSettingsOpen}
        onOpenChange={(open) => dispatch(setProjectSettingsOpen(open))}
      />
    </TooltipProvider>
  );
}

export const EditorToolbar = React.memo(EditorToolbarComponent);
