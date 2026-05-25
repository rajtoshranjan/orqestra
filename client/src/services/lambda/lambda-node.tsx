import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { FunctionSquare } from 'lucide-react';
import type { ServiceValidationErrors } from '../types';
import type { LambdaConfig } from './types';

type LambdaNodeDataShape = {
  serviceId: string;
  label: string;
  config: LambdaConfig;
  validationErrors: ServiceValidationErrors;
};

function LambdaNodeComponent({
  data,
  selected,
}: NodeProps<LambdaNodeDataShape>) {
  const { config, validationErrors } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <div
      className={[
        'duration-[var(--transition-base)] group relative min-w-[220px] rounded-[var(--radius-md)] border transition-all',
        'hover:-translate-y-px hover:shadow-[var(--shadow-lg)]',
        selected && !hasErrors
          ? 'border-[var(--color-accent)] shadow-[var(--shadow-glow)]'
          : '',
        hasErrors ? 'border-[var(--color-warning)]' : '',
        !selected && !hasErrors ? 'border-[var(--color-border)]' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ background: 'var(--color-bg-elevated)' }}
    >
      {/* Target Handle (left) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !rounded-full !border-2 !border-[var(--color-accent)] !bg-[var(--color-bg-surface)]"
      />

      {/* Source Handle (right) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !rounded-full !border-2 !border-[var(--color-accent)] !bg-[var(--color-bg-surface)]"
      />

      {/* Header */}
      <div className="flex items-start gap-3 px-4 pb-3 pt-4">
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)]"
          style={{ background: 'var(--color-accent-subtle)' }}
        >
          <FunctionSquare size={16} className="text-[var(--color-accent)]" />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--color-text-muted)' }}
          >
            AWS Lambda
          </p>
          <p
            className="truncate text-sm font-bold leading-snug"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {config.functionName || 'Untitled'}
          </p>
          <span
            className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{
              background: 'var(--color-cyan-subtle)',
              color: 'var(--color-cyan)',
            }}
          >
            {config.runtime}
          </span>
        </div>
      </div>

      {/* Stats Bar */}
      <div
        className="flex items-center gap-4 rounded-b-[var(--radius-md)] px-4 py-2 text-[11px] font-medium"
        style={{
          background: 'var(--color-bg-base)',
          color: 'var(--color-text-secondary)',
        }}
      >
        <span>{config.memorySize} MB</span>
        <span className="opacity-30">|</span>
        <span>{config.timeout}s timeout</span>
      </div>

      {/* Status Pill */}
      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
        {hasErrors ? (
          <span
            className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-semibold shadow-sm"
            style={{
              background: 'var(--color-bg-elevated)',
              color: 'var(--color-warning)',
              border: '1px solid var(--color-warning)',
            }}
          >
            <span className="inline-block size-1.5 rounded-full bg-[var(--color-warning)]" />
            {errorCount} field{errorCount > 1 ? 's' : ''} need attention
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-semibold shadow-sm"
            style={{
              background: 'var(--color-bg-elevated)',
              color: 'var(--color-success)',
              border: '1px solid var(--color-success)',
            }}
          >
            <span className="inline-block size-1.5 rounded-full bg-[var(--color-success)]" />
            Ready
          </span>
        )}
      </div>
    </div>
  );
}

export const LambdaNode = memo(LambdaNodeComponent);
