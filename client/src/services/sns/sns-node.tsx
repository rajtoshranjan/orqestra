import { memo } from 'react';
import type { NodeProps } from 'reactflow';

import type { ServiceValidationErrors } from '../types';
import type { SNSConfig } from './types';

import { SnsIcon } from '@/components/icons';
import { BaseServiceNode } from '@/components';

type SNSNodeDataShape = {
  serviceId: string;
  label: string;
  config: SNSConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function SNSNodeComponent({ data, selected }: NodeProps<SNSNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#ef4899"
      icon={SnsIcon}
      serviceLabel={`SNS (${config.fifoTopic ? 'FIFO' : 'Standard'})`}
      title={config.topicName || 'Untitled'}
      tag={config.fifoTopic ? 'fifo' : 'standard'}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const SNSNode = memo(SNSNodeComponent);
