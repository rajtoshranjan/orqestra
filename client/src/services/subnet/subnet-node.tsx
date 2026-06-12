import { memo } from 'react';

import { BaseContainerNode } from '@/components';
import { SubnetIcon } from '@/components/icons';

import type { ServiceValidationErrors } from '../types';
import type { SubnetConfig } from './types';
import type { NodeProps } from 'reactflow';

type SubnetNodeDataShape = {
  serviceId: string;
  label: string;
  config: SubnetConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
  isDragOver?: boolean;
  onToggleCollapse?: () => void;
};

function SubnetNodeComponent({
  id,
  data,
  selected,
}: NodeProps<SubnetNodeDataShape>) {
  const { config, isDragOver, onToggleCollapse } = data;

  return (
    <BaseContainerNode
      id={id}
      selected={selected}
      accentColor="#059669"
      icon={SubnetIcon}
      serviceLabel={`AWS Subnet (${config.subnetType || 'private'})`}
      title={config.subnetName || 'Untitled'}
      isCollapsed={config.isCollapsed}
      onToggleCollapse={onToggleCollapse}
      borderStyle="dashed"
      isDragOver={isDragOver}
    />
  );
}

export const SubnetNode = memo(SubnetNodeComponent);
