import { memo } from 'react';

import { BaseServiceNode } from '@/components';
import { EcsIcon } from '@/components/icons';

import type { ServiceValidationErrors } from '../types';
import type { EcsClusterConfig } from './types';
import type { NodeProps } from 'reactflow';

type EcsClusterNodeDataShape = {
  serviceId: string;
  label: string;
  config: EcsClusterConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function EcsClusterNodeComponent({
  data,
  selected,
}: NodeProps<EcsClusterNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#FF9900"
      icon={EcsIcon}
      serviceLabel="Amazon ECS"
      title={config.clusterName || 'Untitled'}
      tag={config.launchType}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const EcsClusterNode = memo(EcsClusterNodeComponent);
