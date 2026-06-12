import React from 'react';

import {
  WandSparkles,
  CloudUpload,
  Loader2,
  Link,
  ShieldCheck,
  ShieldAlert,
  BadgeDollarSign,
  AlertTriangle,
} from 'lucide-react';

import {
  Button,
  Input,
  Badge,
  Card,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import type {
  DeploymentSettings,
  PlanSummary,
  DeploymentResult,
  DeploymentLogLevel,
  ServicePlanResource,
  PlanResourceAction,
  DiagramNode,
  DiagramEdge,
} from '@/types';
import { formatTimestamp } from '@/utils';
import { estimateMonthlyCost } from '@/utils/cost-estimator';
import { scanSecurityRisks } from '@/utils/security-scanner';

export type EnrichedPlanResource = ServicePlanResource & {
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
  action?: PlanResourceAction;
};

export type DeployDrawerProps = {
  open: boolean;
  onClose: () => void;
  deploymentSettings: DeploymentSettings;
  onSettingsChange: (settings: DeploymentSettings) => void;
  planSummary: PlanSummary & {
    resources: EnrichedPlanResource[];
  };
  deploymentResult: DeploymentResult;
  onPlan: () => void;
  onDeploy: () => void;
  onOpenProjectSettings: () => void;
  awsAccountId: string | null;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
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

const ACTION_BADGE_STYLES: Record<
  PlanResourceAction,
  { label: string; className: string }
> = {
  create: {
    label: 'Create',
    className: 'bg-success/15 text-success border-success/30',
  },
  update: {
    label: 'Update',
    className: 'bg-warning/15 text-warning border-warning/30',
  },
  destroy: {
    label: 'Destroy',
    className: 'bg-destructive/15 text-destructive border-destructive/30',
  },
  no_change: {
    label: 'No Change',
    className: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  },
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
  onOpenProjectSettings,
  awsAccountId,
  nodes,
  edges,
}: DeployDrawerProps) {
  const status = deploymentResult.status;
  const isRunning = status === 'in-progress';
  const statusStyle = STATUS_STYLES[status];

  const hasChanges = planSummary.resources.some(
    (resource) => resource.action && resource.action !== 'no_change',
  );

  function patchSettings(patch: Partial<DeploymentSettings>) {
    onSettingsChange({ ...deploymentSettings, ...patch });
  }

  // Cost and security calculations
  const cost = React.useMemo(
    () => estimateMonthlyCost(nodes, edges),
    [nodes, edges],
  );
  const securityWarnings = React.useMemo(
    () => scanSecurityRisks(nodes, edges),
    [nodes, edges],
  );
  const highRiskCount = securityWarnings.filter(
    (w) => w.severity === 'high',
  ).length;

  return (
    <Sheet open={open} onOpenChange={(val) => !val && onClose()}>
      <SheetContent
        side="right"
        className="flex w-[400px] flex-col border-l border-border bg-card p-0 shadow-xl sm:max-w-[400px]"
      >
        {/* Header */}
        <SheetHeader className="flex h-11 shrink-0 flex-row items-center justify-between space-y-0 border-b border-border px-4 py-0">
          <SheetTitle className="text-xs font-semibold text-foreground">
            Deployment & Planning
          </SheetTitle>
        </SheetHeader>

        {/* Tab Controls */}
        <Tabs
          defaultValue="plan"
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="shrink-0 border-b border-border bg-card/50 px-2 py-1.5">
            <TabsList className="grid h-8 w-full grid-cols-4 rounded-md bg-muted/65 p-1">
              <TabsTrigger
                value="plan"
                className="py-1 text-[10px] font-medium"
              >
                Plan
              </TabsTrigger>
              <TabsTrigger
                value="security"
                className="flex items-center justify-center gap-1 py-1 text-[10px] font-medium"
              >
                Security
                {securityWarnings.length > 0 && (
                  <span
                    className={cn(
                      'flex size-3.5 items-center justify-center rounded-full text-[8px] text-white',
                      highRiskCount > 0 ? 'bg-destructive' : 'bg-warning',
                    )}
                  >
                    {securityWarnings.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="cost"
                className="py-1 text-[10px] font-medium"
              >
                Cost
              </TabsTrigger>
              <TabsTrigger
                value="logs"
                className="py-1 text-[10px] font-medium"
              >
                Logs
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto">
            {/* PLAN TAB */}
            <TabsContent value="plan" className="m-0 space-y-5 p-4">
              {!awsAccountId && (
                <div className="flex items-start gap-2.5 rounded-md border border-warning/30 bg-warning/10 p-3">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-warning">
                      No AWS account linked
                    </p>
                    <p className="text-[10.5px] leading-relaxed text-muted-foreground">
                      Attach an AWS account to this project before deploying.
                    </p>
                    <button
                      onClick={onOpenProjectSettings}
                      className="text-[10.5px] font-medium text-warning/80 underline underline-offset-2 hover:no-underline"
                    >
                      Open Project Settings →
                    </button>
                  </div>
                </div>
              )}

              <section>
                <SectionHeader>Deployment Region</SectionHeader>
                <div className="space-y-4">
                  <div>
                    <label className="input-label">AWS Region</label>
                    <Input
                      type="text"
                      value={deploymentSettings.region}
                      onChange={(event) =>
                        patchSettings({ region: event.target.value })
                      }
                      className="h-8 border-border/80 bg-background/50 text-xs"
                    />
                  </div>
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
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
                  {planSummary.resources.map(
                    (resource: EnrichedPlanResource) => {
                      const actionStyle = resource.action
                        ? ACTION_BADGE_STYLES[resource.action]
                        : null;
                      const isDestroy = resource.action === 'destroy';

                      return (
                        <Card
                          key={resource.id}
                          className={cn(
                            'bg-card-elevated rounded-md border border-border/60 bg-background/35 p-2.5 shadow-none transition-all duration-200 hover:border-primary/30',
                            isDestroy &&
                              'border-destructive/40 bg-destructive/5 opacity-80 hover:border-destructive/50',
                          )}
                        >
                          <div className="mb-1 flex items-center justify-between">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <span
                                className={cn(
                                  'size-1.5 shrink-0 rounded-full',
                                  isDestroy && 'pulse-red bg-destructive',
                                  !isDestroy &&
                                    resource.deploymentStatus === 'deployed' &&
                                    'pulse-green bg-success',
                                  !isDestroy &&
                                    resource.deploymentStatus === 'dirty' &&
                                    'pulse-amber bg-warning',
                                  !isDestroy &&
                                    resource.deploymentStatus ===
                                      'not_deployed' &&
                                    'pulse-gray bg-slate-500',
                                )}
                              />
                              <span
                                className={cn(
                                  'truncate text-xs font-medium text-foreground',
                                  isDestroy &&
                                    'text-muted-foreground line-through',
                                )}
                              >
                                {resource.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {actionStyle && (
                                <span
                                  className={cn(
                                    'rounded-full border px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide',
                                    actionStyle.className,
                                  )}
                                >
                                  {actionStyle.label}
                                </span>
                              )}
                              {!isDestroy && (
                                <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                                  <Link className="size-2.5" />
                                  {resource.connectionCount}
                                </div>
                              )}
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
                                <span className="text-foreground">
                                  {detail.value}
                                </span>
                              </span>
                            ))}
                          </div>
                        </Card>
                      );
                    },
                  )}

                  {planSummary.resources.length === 0 && (
                    <p className="py-4 text-center text-xs text-muted-foreground">
                      No resources in the plan yet.
                    </p>
                  )}
                </div>
              </section>

              <section className="border-t border-border/60 pt-2">
                <Button
                  onClick={onDeploy}
                  disabled={isRunning || !hasChanges || !awsAccountId}
                  className="flex h-9 w-full items-center justify-center gap-2 bg-gradient-to-r from-primary to-[#6366f1] text-xs font-semibold text-white shadow-md hover:brightness-105 disabled:opacity-50"
                  size="default"
                >
                  {isRunning ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <CloudUpload className="size-3.5" />
                  )}
                  {isRunning ? 'Deploying…' : 'Deploy to AWS'}
                </Button>
                {!awsAccountId && (
                  <p className="mt-1.5 text-center text-[10px] text-warning/80">
                    Link an AWS account in project settings to deploy.
                  </p>
                )}
                {awsAccountId && !hasChanges && !isRunning && (
                  <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
                    No changes detected in the architecture plan.
                  </p>
                )}
              </section>
            </TabsContent>

            {/* SECURITY TAB */}
            <TabsContent value="security" className="m-0 space-y-4 p-4">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                {securityWarnings.length === 0 ? (
                  <>
                    <ShieldCheck className="size-5 text-success" />
                    <span className="text-xs font-semibold text-foreground">
                      Infrastructure Security Clean
                    </span>
                  </>
                ) : (
                  <>
                    <ShieldAlert
                      className={cn(
                        'size-5',
                        highRiskCount > 0 ? 'text-destructive' : 'text-warning',
                      )}
                    />
                    <span className="text-xs font-semibold text-foreground">
                      {securityWarnings.length} Security Issue
                      {securityWarnings.length > 1 ? 's' : ''} Flagged
                    </span>
                  </>
                )}
              </div>

              {securityWarnings.length > 0 ? (
                <div className="space-y-3">
                  {securityWarnings.map((warning) => (
                    <Card
                      key={warning.id}
                      className={cn(
                        'rounded-md border p-3',
                        warning.severity === 'high'
                          ? 'border-destructive/30 bg-destructive/5'
                          : warning.severity === 'medium'
                            ? 'border-warning/30 bg-warning/5'
                            : 'border-primary/30 bg-primary/5',
                      )}
                    >
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">
                          {warning.title}
                        </span>
                        <Badge
                          variant={
                            warning.severity === 'high'
                              ? 'destructive'
                              : 'warning'
                          }
                          className="h-4 px-1.5 text-[8px] font-semibold uppercase tracking-wide"
                        >
                          {warning.severity}
                        </Badge>
                      </div>
                      <p className="text-[10.5px] leading-relaxed text-muted-foreground">
                        {warning.description}
                      </p>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-xs leading-relaxed text-muted-foreground">
                  No security vulnerabilities or broad configuration permissions
                  detected. Good job!
                </p>
              )}
            </TabsContent>

            {/* COST TAB */}
            <TabsContent value="cost" className="m-0 space-y-4 p-4">
              <Card className="flex flex-col justify-between border border-border bg-gradient-to-br from-accent/5 via-card to-card p-4 shadow-sm">
                <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <BadgeDollarSign className="size-4 text-success" />
                  Estimated Monthly Bill
                </div>
                <div className="flex items-baseline gap-1 text-2xl font-bold tracking-tight text-foreground">
                  ${cost.total}
                  <span className="text-xs font-normal text-muted-foreground">
                    / month
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Based on standard 1M baseline requests/month.
                </p>
              </Card>

              {cost.worstCaseTotal > cost.total && (
                <Card className="rounded-md border-warning/20 bg-warning/5 p-3 text-warning">
                  <span className="mb-0.5 block text-xs font-bold">
                    Worst Case Scenario Estimate
                  </span>
                  <span className="text-xs">
                    If function executions continuously hit their maximum
                    timeout, monthly bill could scale to **$
                    {cost.worstCaseTotal}**.
                  </span>
                </Card>
              )}

              <section className="space-y-2">
                <SectionHeader>Monthly Cost Breakdown</SectionHeader>
                <div className="space-y-1.5">
                  {[
                    { label: 'Serverless Compute (Lambda)', val: cost.lambda },
                    { label: 'Outbound Transit (NAT Gateway)', val: cost.nat },
                    { label: 'Storage Mounts (EFS)', val: cost.efs },
                    { label: 'APIs (API Gateway)', val: cost.apigw },
                    { label: 'Database (DynamoDB)', val: cost.databases },
                    { label: 'Messaging (SQS/SNS)', val: cost.queues },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between border-b border-border/40 py-1 text-xs"
                    >
                      <span className="text-muted-foreground">
                        {item.label}
                      </span>
                      <span className="font-medium text-foreground">
                        ${item.val}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-2">
                <SectionHeader>Cost Drivers</SectionHeader>
                <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground">
                  {cost.costDrivers.map((driver) => (
                    <li key={driver}>{driver}</li>
                  ))}
                </ul>
              </section>
            </TabsContent>

            {/* LOGS TAB */}
            <TabsContent value="logs" className="m-0 space-y-4 p-4">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <SectionHeader>Deployment logs</SectionHeader>
                <Badge
                  variant={statusStyle.badgeVariant}
                  className="rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                >
                  {statusStyle.label}
                </Badge>
              </div>

              {deploymentResult.logs.length > 0 ? (
                <div className="max-h-[400px] space-y-1.5 overflow-y-auto rounded-md border border-border bg-background/50 p-3 font-mono text-[10px]">
                  {deploymentResult.logs.map((log) => (
                    <div
                      key={log.id}
                      className="animate-fade-in flex items-start gap-2 py-0.5"
                    >
                      <span
                        className={`mt-1 size-1.5 shrink-0 rounded-full ${LOG_DOT_COLOR[log.level]}`}
                      />
                      <span className="whitespace-pre-wrap break-all leading-normal text-muted-foreground">
                        {log.message}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  No logs generated. Run plan or deployment.
                </p>
              )}

              {deploymentResult.lastRunAt && (
                <p className="text-[10px] text-muted-foreground">
                  Last run: {formatTimestamp(deploymentResult.lastRunAt)}
                </p>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
