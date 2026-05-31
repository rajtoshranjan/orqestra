import React from 'react';
import {
  ArrowLeft,
  Grid3x3,
  WandSparkles,
  Rocket,
  Loader2,
  Lock,
  Unlock,
  Pencil,
} from 'lucide-react';

import { formatRelativeTime, hasValidationErrors } from '@/utils';
import {
  Button,
  Badge,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  setProjectName,
  setSnapToGrid,
  setIsLocked,
  setProjectDescription,
} from '@/store/editor-slice';
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
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [editName, setEditName] = React.useState('');
  const [editDesc, setEditDesc] = React.useState('');

  const { projectName, projectDescription, lastSavedAt, snapToGrid, isLocked, nodes } =
    useAppSelector((state) => state.editor);
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

  const openSettings = () => {
    setEditName(projectName);
    setEditDesc(projectDescription || '');
    setSettingsOpen(true);
  };

  const saveSettings = () => {
    dispatch(setProjectName(editName));
    dispatch(setProjectDescription(editDesc));
    setSettingsOpen(false);
  };

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

          <span className="max-w-[200px] truncate px-1.5 py-0.5 text-xs font-medium text-foreground">
            {projectName || 'Untitled Project'}
          </span>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={openSettings}
                className="size-7 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Pencil size={13} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Edit Project Info
            </TooltipContent>
          </Tooltip>
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

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Project Settings</DialogTitle>
            <DialogDescription>
              Update your project&apos;s name and description.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="name" className="text-sm font-medium">
                Project Name
              </label>
              <input
                id="name"
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="description" className="text-sm font-medium">
                Description
              </label>
              <textarea
                id="description"
                value={editDesc}
                onChange={(event) => setEditDesc(event.target.value)}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveSettings}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
