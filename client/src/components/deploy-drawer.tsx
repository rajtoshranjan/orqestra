import { X, WandSparkles, CloudUpload, Loader2, Link } from 'lucide-react';
import type {
  DeploymentSettings,
  PlanSummary,
  DeploymentResult,
  DeploymentLogLevel,
} from '@/types';
import { formatTimestamp } from '@/utils';

export interface DeployDrawerProps {
  open: boolean;
  onClose: () => void;
  deploymentSettings: DeploymentSettings;
  onSettingsChange: (settings: DeploymentSettings) => void;
  planSummary: PlanSummary;
  deploymentResult: DeploymentResult;
  onPlan: () => void;
  onDeploy: () => void;
}

const STATUS_STYLES: Record<
  DeploymentResult['status'],
  { bg: string; text: string; label: string }
> = {
  idle: {
    bg: 'bg-[var(--color-text-muted)]/15',
    text: 'text-[var(--color-text-muted)]',
    label: 'Idle',
  },
  pending: {
    bg: 'bg-[var(--color-warning)]/15',
    text: 'text-[var(--color-warning)]',
    label: 'Pending',
  },
  'in-progress': {
    bg: 'bg-[var(--color-warning)]/15',
    text: 'text-[var(--color-warning)]',
    label: 'In Progress',
  },
  success: {
    bg: 'bg-[var(--color-success)]/15',
    text: 'text-[var(--color-success)]',
    label: 'Success',
  },
  failed: {
    bg: 'bg-[var(--color-error)]/15',
    text: 'text-[var(--color-error)]',
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
    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
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
  if (!open) return null;

  const status = deploymentResult.status;
  const isRunning = status === 'in-progress';
  const statusStyle = STATUS_STYLES[status];

  function patchSettings(patch: Partial<DeploymentSettings>) {
    onSettingsChange({ ...deploymentSettings, ...patch });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="duration-[var(--transition-base)] absolute inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <aside className="animate-slide-in-right relative flex h-full w-[420px] flex-col border-l border-[var(--color-border)] bg-[var(--color-bg-surface)] shadow-[var(--shadow-lg)]">
        {/* ─── Header ──────────────────────────────────────────── */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--color-border)] px-5">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Deployment
          </h2>
          <button
            onClick={onClose}
            className="duration-[var(--transition-fast)] rounded-[var(--radius-sm)] p-1.5 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
            aria-label="Close drawer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ─── Scrollable Body ─────────────────────────────────── */}
        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {/* ── Settings Section ─────────────────────────────────── */}
          <section>
            <SectionHeader>Settings</SectionHeader>
            <div className="space-y-4">
              <div>
                <label className="input-label">AWS Region</label>
                <input
                  type="text"
                  className="input-field w-full"
                  value={deploymentSettings.region}
                  onChange={(e) => patchSettings({ region: e.target.value })}
                />
              </div>
              <div>
                <label className="input-label">Execution Role ARN</label>
                <input
                  type="text"
                  className="input-field w-full"
                  placeholder="arn:aws:iam::..."
                  value={deploymentSettings.executionRoleArn}
                  onChange={(e) =>
                    patchSettings({ executionRoleArn: e.target.value })
                  }
                />
              </div>
            </div>
          </section>

          {/* ── Plan Summary Section ────────────────────────────── */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  Resource Plan
                </h3>
                <span className="rounded-full bg-[var(--color-accent-subtle)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-accent)]">
                  {planSummary.resourceCount}
                </span>
              </div>
              <button
                onClick={onPlan}
                className="duration-[var(--transition-fast)] flex items-center gap-1.5 text-xs font-medium text-[var(--color-accent)] transition-colors hover:text-[var(--color-accent-hover)]"
              >
                <WandSparkles className="h-3.5 w-3.5" />
                Plan
              </button>
            </div>

            <div className="space-y-2">
              {planSummary.resources.map((resource) => (
                <div
                  key={resource.id}
                  className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3"
                >
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                      {resource.name}
                    </span>
                    <div className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
                      <Link className="h-3 w-3" />
                      {resource.connectionCount}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--color-text-secondary)]">
                    {resource.details.map((detail) => (
                      <span
                        key={detail.label}
                        className="flex items-center gap-1"
                      >
                        <span className="text-[var(--color-text-muted)]">
                          {detail.label}:
                        </span>
                        {detail.value}
                      </span>
                    ))}
                  </div>
                </div>
              ))}

              {planSummary.resources.length === 0 && (
                <p className="py-4 text-center text-xs text-[var(--color-text-muted)]">
                  No resources in the plan yet.
                </p>
              )}
            </div>
          </section>

          {/* ── Deploy Section ──────────────────────────────────── */}
          <section>
            <SectionHeader>Deploy</SectionHeader>
            <button
              onClick={onDeploy}
              disabled={isRunning}
              className="duration-[var(--transition-base)] flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-gradient-to-r from-[var(--color-accent)] to-[#6366f1] px-4 py-3 text-sm font-semibold text-white shadow-[var(--shadow-md)] transition-all hover:from-[var(--color-accent-hover)] hover:to-[#818cf8] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CloudUpload className="h-4 w-4" />
              )}
              {isRunning ? 'Deploying…' : 'Deploy to AWS'}
            </button>
          </section>

          {/* ── Deployment Logs Section ─────────────────────────── */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <SectionHeader>Deployment Logs</SectionHeader>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusStyle.bg} ${statusStyle.text}`}
              >
                {statusStyle.label}
              </span>
            </div>

            {deploymentResult.logs.length > 0 ? (
              <div className="space-y-1.5">
                {deploymentResult.logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-2 text-xs text-[var(--color-text-secondary)]"
                  >
                    <span
                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${LOG_DOT_COLOR[log.level]}`}
                    />
                    <span className="leading-relaxed">{log.message}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-3 text-center text-xs text-[var(--color-text-muted)]">
                No logs yet.
              </p>
            )}

            {deploymentResult.lastRunAt && (
              <p className="mt-3 text-[10px] text-[var(--color-text-muted)]">
                Last run: {formatTimestamp(deploymentResult.lastRunAt)}
              </p>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}
