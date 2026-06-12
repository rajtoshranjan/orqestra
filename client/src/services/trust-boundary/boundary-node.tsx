import { memo } from 'react';

import { Shield } from 'lucide-react';

import { BaseContainerNode } from '@/components';

import type { ServiceValidationErrors } from '../types';
import type { TrustBoundaryConfig } from './types';
import type { NodeProps } from 'reactflow';

type TrustBoundaryNodeData = {
  serviceId: string;
  label: string;
  config: TrustBoundaryConfig;
  validationErrors: ServiceValidationErrors;
  isDragOver?: boolean;
  onToggleCollapse?: () => void;
};

function TrustBoundaryNodeComponent({
  id,
  data,
  selected,
}: NodeProps<TrustBoundaryNodeData>) {
  const { config, isDragOver, onToggleCollapse } = data;

  return (
    <BaseContainerNode
      id={id}
      selected={selected}
      accentColor="#ef4444"
      icon={Shield}
      serviceLabel="Trust Boundary"
      title={config.boundaryName || 'Untitled Boundary'}
      isCollapsed={config.isCollapsed}
      onToggleCollapse={onToggleCollapse}
      borderStyle="dashed"
      isDragOver={isDragOver}
    />
  );
}

export const TrustBoundaryNode = memo(TrustBoundaryNodeComponent);
