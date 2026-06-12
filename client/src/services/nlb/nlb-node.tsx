import { memo } from 'react';

import { BaseServiceNode } from '@/components';
import { NlbIcon } from '@/components/icons';

import type { ServiceValidationErrors } from '../types';
import type { NlbConfig } from './types';
import type { NodeProps } from 'reactflow';

type NlbNodeDataShape = {
  serviceId: string;
  label: string;
  config: NlbConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function NlbNodeComponent({ data, selected }: NodeProps<NlbNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#29B0D9"
      icon={NlbIcon}
      serviceLabel="Network Load Balancer"
      title={config.loadBalancerName || 'Untitled'}
      tag={config.scheme}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const NlbNode = memo(NlbNodeComponent);
