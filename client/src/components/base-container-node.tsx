import React from 'react';
import { Handle, Position, NodeResizer } from 'reactflow';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type BaseContainerNodeProps = {
  id: string;
  selected: boolean;
  accentColor: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  serviceLabel: string;
  title: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  borderStyle?: 'solid' | 'dashed' | 'dotted';
  isDragOver?: boolean;
  isConnectingActive?: boolean;
  isValidTarget?: boolean;
  children?: React.ReactNode;
};

export function BaseContainerNode({
  selected,
  accentColor,
  icon: ServiceIcon,
  serviceLabel,
  title,
  isCollapsed = false,
  onToggleCollapse,
  borderStyle = 'solid',
  isDragOver = false,
  isConnectingActive = false,
  isValidTarget = true,
  children,
}: BaseContainerNodeProps) {
  const borderClass =
    borderStyle === 'dashed'
      ? 'border-dashed'
      : borderStyle === 'dotted'
        ? 'border-dotted'
        : 'border-solid';

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-xl border transition-[border-color,box-shadow,background-color] duration-200',
        'bg-background/25 text-foreground backdrop-blur-md',
        borderClass,
        selected
          ? 'border-primary shadow-[0_0_15px_rgba(99,102,241,0.2)]'
          : 'border-border',
        isDragOver
          ? 'border-primary bg-primary/10 ring-2 ring-primary ring-opacity-50'
          : 'hover:border-primary/50',
        isCollapsed
          ? 'h-[56px] min-w-[200px]'
          : 'h-full min-h-[140px] w-full min-w-[220px]',
        isConnectingActive && !isValidTarget
          ? 'pointer-events-none opacity-30'
          : '',
      )}
      style={{
        borderColor: selected
          ? accentColor
          : isDragOver
            ? accentColor
            : accentColor && accentColor.startsWith('#')
              ? `${accentColor}59` // 35% opacity border by default
              : undefined,
        backgroundColor:
          accentColor && accentColor.startsWith('#')
            ? `${accentColor}08`
            : undefined, // 3.1% opacity tint
      }}
    >
      {/* Node Resizer - only visible when selected and NOT collapsed */}
      {!isCollapsed && (
        <NodeResizer
          color={accentColor}
          minWidth={220}
          minHeight={140}
          isVisible={selected}
          handleStyle={{
            width: 6,
            height: 6,
            background: 'var(--color-bg-surface)',
            border: `2px solid ${accentColor}`,
            borderRadius: '2px',
          }}
          lineStyle={{
            borderColor: accentColor,
            borderWidth: '1.5px',
          }}
        />
      )}

      {/* Target Handle (left) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !rounded-full !border-2 !bg-[var(--color-bg-surface)]"
        style={{ borderColor: accentColor }}
      />

      {/* Source Handle (right) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !rounded-full !border-2 !bg-[var(--color-bg-surface)]"
        style={{ borderColor: accentColor }}
      />

      {/* Header Row */}
      <div
        className={cn(
          'flex items-center gap-2 rounded-t-xl border-b bg-muted/40 px-3 py-2 transition-colors',
          isCollapsed
            ? 'h-full rounded-xl border-transparent'
            : 'border-border',
        )}
      >
        {/* Collapse Toggle Button */}
        {onToggleCollapse && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse();
            }}
            className="flex size-5 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted-foreground/15"
          >
            {isCollapsed ? (
              <ChevronRight size={14} />
            ) : (
              <ChevronDown size={14} />
            )}
          </button>
        )}

        {/* Icon */}
        <div
          className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border/80 bg-background/50"
          style={{ color: accentColor }}
        >
          <ServiceIcon size={15} />
        </div>

        {/* Labels */}
        <div className="flex min-w-0 flex-1 select-none flex-col text-left">
          <p className="mb-0.5 text-[7.5px] font-bold uppercase leading-none tracking-wider text-muted-foreground">
            {serviceLabel}
          </p>
          <p className="truncate text-[10.5px] font-semibold leading-tight text-foreground">
            {title}
          </p>
        </div>
      </div>

      {/* Content Container - hidden when collapsed */}
      {!isCollapsed && (
        <div className="pointer-events-none relative size-full flex-1 p-4">
          {children}
        </div>
      )}
    </div>
  );
}
