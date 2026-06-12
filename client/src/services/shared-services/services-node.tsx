import { memo } from 'react';

import { Share2 } from 'lucide-react';

import { BaseContainerNode } from '@/components';

import type { ServiceValidationErrors } from '../types';
import type { SharedServicesConfig } from './types';
import type { NodeProps } from 'reactflow';

type SharedServicesNodeData = {
  serviceId: string;
  label: string;
  config: SharedServicesConfig;
  validationErrors: ServiceValidationErrors;
  isDragOver?: boolean;
  onToggleCollapse?: () => void;
};

function SharedServicesNodeComponent({
  id,
  data,
  selected,
}: NodeProps<SharedServicesNodeData>) {
  const { config, isDragOver, onToggleCollapse } = data;

  return (
    <BaseContainerNode
      id={id}
      selected={selected}
      accentColor="#ec4899"
      icon={Share2}
      serviceLabel="Shared Services"
      title={config.servicesName || 'Untitled Boundary'}
      isCollapsed={config.isCollapsed}
      onToggleCollapse={onToggleCollapse}
      borderStyle="dashed"
      isDragOver={isDragOver}
    />
  );
}

export const SharedServicesNode = memo(SharedServicesNodeComponent);
