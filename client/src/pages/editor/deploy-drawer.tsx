import { WandSparkles, CloudUpload, Loader2, Link } from 'lucide-react';

import type {
  DeploymentSettings,
  PlanSummary,
  DeploymentResult,
  DeploymentLogLevel,
} from '@/types';
import { formatTimestamp } from '@/utils';
import {
  Button,
  Input,
  Badge,
  Card,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui';

export type DeployDrawerProps = {
  open: boolean;
  onClose: () => void;
  deploymentSettings: DeploymentSettings;
  onSettingsChange: (settings: DeploymentSettings) => void;
  planSummary: PlanSummary;
  deploymentResult: DeploymentResult;
  onPlan: () => void;
  onDeploy: () => void;
};

const STATUS_STYLES: Record<
  DeploymentResult['status'],
  {
    badgeVariant: 'outline' | 'warning' | 'success' | 'destructive';
    label: string;
  }
> = {
  idle: {
    badgeVariant: 'outline',
    label: 'Idle',
  },
  pending: {
    badgeVariant: 'warning',
    label: 'Pending',
  },
  'in-progress': {
    badgeVariant: 'warning',
    label: 'In Progress',
  },
  success: {
    badgeVariant: 'success',
    label: 'Success',
  },
  failed: {
    badgeVariant: 'destructive',
    label: 'Failed',
  },
};

const LOG_DOT_COLOR: Record<DeploymentLogLevel, string> = {
  info: 'bg-[var(--color-accent)]',
  success: 'bg-[var(--color-success)]',
  error: 'bg-[var(--color-error)]',
};

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  );
}

export function DeployDrawer({
  open,
  onClose,
  deploymentSettings,
  onSettingsChange,
  planSummary,
  deploymentResult,
  onPlan,
  onDeploy,
}: DeployDrawerProps) {
  const status = deploymentResult.status;
  const isRunning = status === 'in-progress';
  const statusStyle = STATUS_STYLES[status];

  function patchSettings(patch: Partial<DeploymentSettings>) {
    onSettingsChange({ ...deploymentSettings, ...patch });
  }

  return (
    <Sheet open={open} onOpenChange={(val) => !val && onClose()}>
      <SheetContent
        side="right"
        className="flex w-[360px] flex-col border-l border-border bg-card p-0 shadow-xl sm:max-w-[360px]"
      >
        {/* Header */}
        <SheetHeader className="flex h-11 shrink-0 flex-row items-center justify-between space-y-0 border-b border-border px-4 py-0">
          <SheetTitle className="text-xs font-semibold text-foreground">
            Deployment
          </SheetTitle>
        </SheetHeader>

        {/* Scrollable Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {/* Settings Section */}
          <section>
            <SectionHeader>Settings</SectionHeader>
            <div className="space-y-4">
              <div>
                <label className="input-label">AWS Region</label>
                <Input
                  type="text"
                  value={deploymentSettings.region}
                  onChange={(e) => patchSettings({ region: e.target.value })}
                  className="border-border/80 bg-background/50"
                />
              </div>
              <div>
                <label className="input-label">Execution Role ARN</label>
                <Input
                  type="text"
                  placeholder="arn:aws:iam::..."
                  value={deploymentSettings.executionRoleArn}
                  onChange={(e) =>
                    patchSettings({ executionRoleArn: e.target.value })
                  }
                  className="border-border/80 bg-background/50"
                />
              </div>
            </div>
          </section>

          {/* Plan Summary Section */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="animate-fade-in text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Resource Plan
                </h3>
                <Badge
                  variant="accent"
                  className="rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                >
                  {planSummary.resourceCount}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onPlan}
                className="flex h-auto items-center gap-1 p-0 text-[10px] font-medium text-primary hover:bg-transparent hover:text-primary/80"
              >
                <WandSparkles className="size-3" />
                Plan
              </Button>
            </div>

            <div className="space-y-2">
              {planSummary.resources.map((resource) => (
                <Card
                  key={resource.id}
                  className="bg-card-elevated rounded-md border border-border/60 bg-background/35 p-2.5 shadow-none transition-all duration-200 hover:border-primary/30"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="truncate text-xs font-medium text-foreground">
                      {resource.name}
                    </span>
                    <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                      <Link className="size-2.5" />
                      {resource.connectionCount}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5 text-[10px] text-muted-foreground">
                    {resource.details.map((detail) => (
                      <span
                        key={detail.label}
                        className="flex items-center gap-1"
                      >
                        <span className="text-muted-foreground/60">
                          {detail.label}:
                        </span>
                        <span className="text-foreground">{detail.value}</span>
                      </span>
                    ))}
                  </div>
                </Card>
              ))}

              {planSummary.resources.length === 0 && (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  No resources in the plan yet.
                </p>
              )}
            </div>
          </section>

          {/* Deploy Section */}
          <section>
            <SectionHeader>Deploy</SectionHeader>
            <Button
              onClick={onDeploy}
              disabled={isRunning}
              className="flex w-full items-center justify-center gap-2 bg-gradient-to-r from-primary to-[#6366f1] text-xs font-semibold text-white shadow-md hover:brightness-105 disabled:opacity-50"
              size="default"
            >
              {isRunning ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CloudUpload className="size-3.5" />
              )}
              {isRunning ? 'Deploying…' : 'Deploy to AWS'}
            </Button>
          </section>

          {/* Deployment Logs Section */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <SectionHeader>Deployment Logs</SectionHeader>
              <Badge
                variant={statusStyle.badgeVariant}
                className="rounded-full px-1.5 py-0.5 text-[9px] font-medium"
              >
                {statusStyle.label}
              </Badge>
            </div>

            {deploymentResult.logs.length > 0 ? (
              <div className="space-y-1.5">
                {deploymentResult.logs.map((log) => (
                  <div
                    key={log.id}
                    className="animate-fade-in flex items-start gap-2 text-[11px] text-muted-foreground"
                  >
                    <span
                      className={`mt-1.5 size-1.5 shrink-0 rounded-full ${LOG_DOT_COLOR[log.level]}`}
                    />
                    <span className="leading-relaxed text-muted-foreground">
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-3 text-center text-xs text-muted-foreground">
                No logs yet.
              </p>
            )}

            {deploymentResult.lastRunAt && (
              <p className="mt-3 text-[10px] text-muted-foreground">
                Last run: {formatTimestamp(deploymentResult.lastRunAt)}
              </p>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
