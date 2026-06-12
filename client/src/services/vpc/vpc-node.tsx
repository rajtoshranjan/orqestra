import { memo } from 'react';

import { BaseContainerNode } from '@/components';
import { VpcIcon } from '@/components/icons';

import type { ServiceValidationErrors } from '../types';
import type { VPCConfig } from './types';
import type { NodeProps } from 'reactflow';

type VPCNodeDataShape = {
  serviceId: string;
  label: string;
  config: VPCConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
  isDragOver?: boolean;
  onToggleCollapse?: () => void;
};

function VPCNodeComponent({ id, data, selected }: NodeProps<VPCNodeDataShape>) {
  const { config, isDragOver, onToggleCollapse } = data;

  return (
    <BaseContainerNode
      id={id}
      selected={selected}
      accentColor="#A166FF"
      icon={VpcIcon}
      serviceLabel="AWS VPC"
      title={config.vpcName || 'Untitled'}
      isCollapsed={config.isCollapsed}
      onToggleCollapse={onToggleCollapse}
      borderStyle="solid"
      isDragOver={isDragOver}
    />
  );
}

export const VPCNode = memo(VPCNodeComponent);
