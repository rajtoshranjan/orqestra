import { memo } from 'react';

import { Grid } from 'lucide-react';

import { BaseContainerNode } from '@/components';

import type { ServiceValidationErrors } from '../types';
import type { AZConfig } from './types';
import type { NodeProps } from 'reactflow';

type AZNodeData = {
  serviceId: string;
  label: string;
  config: AZConfig;
  validationErrors: ServiceValidationErrors;
  isDragOver?: boolean;
  onToggleCollapse?: () => void;
};

function AZNodeComponent({ id, data, selected }: NodeProps<AZNodeData>) {
  const { config, isDragOver, onToggleCollapse } = data;

  return (
    <BaseContainerNode
      id={id}
      selected={selected}
      accentColor="#6b7280"
      icon={Grid}
      serviceLabel="AWS AZ"
      title={config.zoneName || 'us-east-1a'}
      isCollapsed={config.isCollapsed}
      onToggleCollapse={onToggleCollapse}
      borderStyle="dotted"
      isDragOver={isDragOver}
    />
  );
}

export const AZNode = memo(AZNodeComponent);
