import React from 'react';
import { Handle, Position, NodeResizer } from 'reactflow';
import { cn } from '@/lib/utils';

export type BaseServiceNodeProps = {
  selected: boolean;
  hasErrors: boolean;
  errorCount?: number;
  accentColor: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  serviceLabel: string;
  title: string;
  tag?: string;
  statsBar?: React.ReactNode;
  children?: React.ReactNode;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

export function BaseServiceNode({
  selected,
  hasErrors,
  errorCount = 0,
  accentColor,
  icon: ServiceIcon,
  serviceLabel,
  title,
  tag,
  statsBar,
  children,
  deploymentStatus = 'not_deployed',
}: BaseServiceNodeProps) {
  return (
    <div
      className={cn(
        'base-service-node group relative flex h-full w-full items-center justify-between gap-2.5 rounded-lg border p-2.5 transition-[border-color,box-shadow,background-color] duration-200',
        'border-[var(--color-border)] bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] shadow-md backdrop-blur-md',
        selected && !hasErrors
          ? 'border-[var(--color-accent)] shadow-[var(--shadow-glow)]'
          : '',
        hasErrors
          ? 'border-[var(--color-warning)] shadow-[0_0_12px_var(--color-warning-subtle)]'
          : '',
        !selected && !hasErrors
          ? 'border-[var(--color-border)] hover:border-[var(--color-accent)]'
          : '',
      )}
      style={{
        minWidth: 160,
        minHeight: 56,
      }}
    >
      {/* Node Resizer. */}
      <NodeResizer
        color={hasErrors ? 'var(--color-warning)' : 'var(--color-accent)'}
        minWidth={160}
        minHeight={56}
        isVisible={selected}
        handleStyle={{
          width: 5,
          height: 5,
          background: 'var(--color-bg-surface)',
          border: `1px solid ${hasErrors ? 'var(--color-warning)' : 'var(--color-accent)'}`,
          borderRadius: '1px',
        }}
        lineStyle={{
          borderColor: hasErrors
            ? 'var(--color-warning)'
            : 'var(--color-accent)',
          borderWidth: '1px',
        }}
      />

      {/* Target Handle (left). */}
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !rounded-full !border-2 !border-[var(--color-accent)] !bg-[var(--color-bg-surface)]"
      />

      {/* Source Handle (right). */}
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !rounded-full !border-2 !border-[var(--color-accent)] !bg-[var(--color-bg-surface)]"
      />

      {/* Left Column: Service Icon Container. */}
      <div
        className="node-icon-container flex size-9 shrink-0 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg-base)] transition-colors group-hover:bg-[var(--color-bg-hover)]"
        style={{ color: accentColor }}
      >
        <ServiceIcon size={18} />
      </div>

      {/* Middle Column: Resource Labels. */}
      <div className="flex min-w-0 flex-1 select-none flex-col justify-center text-left">
        <p className="mb-0.5 text-[7px] font-bold uppercase leading-none tracking-wider text-[var(--color-text-muted)]">
          {serviceLabel}
        </p>
        <p className="truncate text-[10px] font-semibold leading-tight tracking-tight text-[var(--color-text-primary)]">
          {title}
        </p>

        {/* Compact metadata row combining tag and stats. */}
        <div className="mt-1 flex flex-wrap items-center gap-1 text-[7.5px] leading-none text-[var(--color-text-secondary)]">
          {tag && (
            <span className="runtime-tag max-w-[80px] truncate">{tag}</span>
          )}
          {tag && statsBar && <span className="opacity-30">•</span>}
          {statsBar && (
            <span className="node-stats-text flex items-center gap-1">
              {statsBar}
            </span>
          )}
        </div>

        {children}
      </div>

      {/* Pulsing Status Dot (Top Right Corner). */}
      <div className="absolute right-1.5 top-1.5 flex shrink-0 select-none items-center gap-1">
        <span
          className={cn(
            'size-1.5 rounded-full',
            hasErrors && 'pulse-red bg-red-500',
            !hasErrors &&
              deploymentStatus === 'deployed' &&
              'pulse-green bg-emerald-500',
            !hasErrors &&
              deploymentStatus === 'dirty' &&
              'pulse-amber bg-amber-500',
            !hasErrors &&
              deploymentStatus === 'not_deployed' &&
              'pulse-gray bg-slate-500',
          )}
        />
        {hasErrors && (
          <span className="text-[6.5px] font-bold uppercase tracking-wide text-red-500">
            {errorCount}
          </span>
        )}
      </div>
    </div>
  );
}
