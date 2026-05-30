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
}: BaseServiceNodeProps) {
  return (
    <div
      className={cn(
        'base-service-node group relative flex h-full w-full items-center justify-between gap-2.5 rounded-lg border p-2.5 transition-[border-color,box-shadow,background-color] duration-200',
        'bg-zinc-950/90 shadow-md backdrop-blur-md',
        selected && !hasErrors
          ? 'border-violet-500/80 shadow-[0_0_12px_rgba(139,92,246,0.15)]'
          : '',
        hasErrors
          ? 'border-amber-500/80 shadow-[0_0_12px_rgba(245,158,11,0.12)]'
          : '',
        !selected && !hasErrors
          ? 'border-zinc-800/80 hover:border-zinc-700/80'
          : '',
      )}
      style={{
        minWidth: 160,
        minHeight: 56,
      }}
    >
      {/* Node Resizer */}
      <NodeResizer
        color={hasErrors ? '#f59e0b' : '#6366f1'}
        minWidth={160}
        minHeight={56}
        isVisible={selected}
        handleStyle={{
          width: 5,
          height: 5,
          background: '#09090b',
          border: `1px solid ${hasErrors ? '#f59e0b' : '#6366f1'}`,
          borderRadius: '1px',
        }}
        lineStyle={{
          borderColor: hasErrors ? '#f59e0b' : '#6366f1',
          borderWidth: '1px',
        }}
      />

      {/* Target Handle (left) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !rounded-full !border-2 !border-[var(--color-accent)] !bg-[var(--color-bg-surface)]"
      />

      {/* Source Handle (right) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !rounded-full !border-2 !border-[var(--color-accent)] !bg-[var(--color-bg-surface)]"
      />

      {/* Left Column: Service Icon Container */}
      <div
        className="node-icon-container flex size-9 shrink-0 items-center justify-center rounded-md border border-zinc-800/80 bg-zinc-900/40 transition-colors group-hover:bg-zinc-900/60"
        style={{ color: accentColor }}
      >
        <ServiceIcon size={18} />
      </div>

      {/* Middle Column: Resource Labels */}
      <div className="flex min-w-0 flex-1 select-none flex-col justify-center text-left">
        <p className="mb-0.5 text-[7px] font-bold uppercase leading-none tracking-wider text-zinc-500">
          {serviceLabel}
        </p>
        <p className="truncate text-[10px] font-semibold leading-tight tracking-tight text-zinc-100">
          {title}
        </p>

        {/* Compact metadata row combining tag and stats */}
        <div className="mt-1 flex flex-wrap items-center gap-1 text-[7.5px] leading-none text-zinc-400">
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

      {/* Pulsing Status Dot (Top Right Corner) */}
      <div className="absolute right-1.5 top-1.5 flex shrink-0 select-none items-center gap-1">
        <span
          className={cn(
            'size-1 rounded-full',
            hasErrors
              ? 'pulse-amber bg-amber-500'
              : 'pulse-green bg-emerald-500',
          )}
        />
        {hasErrors && (
          <span className="text-[6.5px] font-bold uppercase tracking-wide text-amber-500">
            {errorCount}
          </span>
        )}
      </div>
    </div>
  );
}
