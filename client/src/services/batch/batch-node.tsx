import { memo } from 'react';
import type { NodeProps } from 'reactflow';

import type { ServiceValidationErrors } from '../types';
import type { BatchConfig } from './types';

import { BatchIcon } from '@/components/aws-icons';
import { BaseServiceNode } from '@/components';

type BatchNodeDataShape = {
  serviceId: string;
  label: string;
  config: BatchConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function BatchNodeComponent({
  data,
  selected,
}: NodeProps<BatchNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#FF9900"
      icon={BatchIcon}
      serviceLabel="AWS Batch"
      title={config.computeEnvironmentName || 'Untitled'}
      tag={config.computeType}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const BatchNode = memo(BatchNodeComponent);
