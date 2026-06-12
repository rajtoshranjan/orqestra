import { memo } from 'react';

import { BaseServiceNode } from '@/components';
import { AlbIcon } from '@/components/icons';

import type { ServiceValidationErrors } from '../types';
import type { AlbConfig } from './types';
import type { NodeProps } from 'reactflow';

type AlbNodeDataShape = {
  serviceId: string;
  label: string;
  config: AlbConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function AlbNodeComponent({ data, selected }: NodeProps<AlbNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#29B0D9"
      icon={AlbIcon}
      serviceLabel="ALB"
      title={config.loadBalancerName || 'Untitled'}
      tag={config.scheme}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const AlbNode = memo(AlbNodeComponent);
