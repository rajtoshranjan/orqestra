import { memo } from 'react';

import { BaseServiceNode } from '@/components';
import { KinesisIcon } from '@/components/icons';

import type { ServiceValidationErrors } from '../types';
import type { KinesisConfig } from './types';
import type { NodeProps } from 'reactflow';

type KinesisNodeDataShape = {
  serviceId: string;
  label: string;
  config: KinesisConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function KinesisNodeComponent({
  data,
  selected,
}: NodeProps<KinesisNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#6366f1"
      icon={KinesisIcon}
      serviceLabel="Kinesis Stream"
      title={config.streamName || 'Untitled'}
      tag={`Shards: ${config.shardCount}`}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const KinesisNode = memo(KinesisNodeComponent);
