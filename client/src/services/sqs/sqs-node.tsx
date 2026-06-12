import { memo } from 'react';

import { BaseServiceNode } from '@/components';
import { SqsIcon } from '@/components/icons';

import type { ServiceValidationErrors } from '../types';
import type { SQSConfig } from './types';
import type { NodeProps } from 'reactflow';

type SQSNodeDataShape = {
  serviceId: string;
  label: string;
  config: SQSConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function SQSNodeComponent({ data, selected }: NodeProps<SQSNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#f59e0b"
      icon={SqsIcon}
      serviceLabel={`SQS (${config.fifoQueue ? 'FIFO' : 'Standard'})`}
      title={config.queueName || 'Untitled'}
      tag={`Timeout: ${config.visibilityTimeoutSeconds}s`}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const SQSNode = memo(SQSNodeComponent);
