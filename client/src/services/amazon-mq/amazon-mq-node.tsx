import { memo } from 'react';

import { BaseServiceNode } from '@/components';
import { AmazonMqIcon } from '@/components/icons';

import type { ServiceValidationErrors } from '../types';
import type { AmazonMqConfig } from './types';
import type { NodeProps } from 'reactflow';

type AmazonMqNodeDataShape = {
  serviceId: string;
  label: string;
  config: AmazonMqConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function AmazonMqNodeComponent({
  data,
  selected,
}: NodeProps<AmazonMqNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#FF9900"
      icon={AmazonMqIcon}
      serviceLabel="Amazon MQ"
      title={config.brokerName || 'Untitled'}
      tag={config.engineType}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const AmazonMqNode = memo(AmazonMqNodeComponent);
