import { memo } from 'react';
import type { NodeProps } from 'reactflow';
import { Globe } from 'lucide-react';
import type { ServiceValidationErrors } from '../types';
import type { RegionConfig } from './types';
import { BaseContainerNode } from '@/components';

type RegionNodeData = {
  serviceId: string;
  label: string;
  config: RegionConfig;
  validationErrors: ServiceValidationErrors;
  isDragOver?: boolean;
  onToggleCollapse?: () => void;
};

function RegionNodeComponent({
  id,
  data,
  selected,
}: NodeProps<RegionNodeData>) {
  const { config, isDragOver, onToggleCollapse } = data;

  return (
    <BaseContainerNode
      id={id}
      selected={selected}
      accentColor="#3b82f6"
      icon={Globe}
      serviceLabel="AWS Region"
      title={config.regionName || 'us-east-1'}
      isCollapsed={config.isCollapsed}
      onToggleCollapse={onToggleCollapse}
      borderStyle="dashed"
      isDragOver={isDragOver}
    />
  );
}

export const RegionNode = memo(RegionNodeComponent);
