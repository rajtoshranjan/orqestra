import { memo } from 'react';
import type { NodeProps } from 'reactflow';

import type { ServiceValidationErrors } from '../types';
import type { MskConfig } from './types';

import { MskIcon } from '@/components/aws-icons';
import { BaseServiceNode } from '@/components';

type MskNodeDataShape = {
  serviceId: string;
  label: string;
  config: MskConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function MskNodeComponent({ data, selected }: NodeProps<MskNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#FF9900"
      icon={MskIcon}
      serviceLabel="Amazon MSK"
      title={config.clusterName || 'Untitled'}
      tag={`${config.brokerCount} brokers`}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const MskNode = memo(MskNodeComponent);
