import { memo } from 'react';

import { BaseServiceNode } from '@/components';
import { ElastiCacheIcon } from '@/components/icons';

import type { ServiceValidationErrors } from '../types';
import type { ElastiCacheConfig } from './types';
import type { NodeProps } from 'reactflow';

type ElastiCacheNodeDataShape = {
  serviceId: string;
  label: string;
  config: ElastiCacheConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function ElastiCacheNodeComponent({
  data,
  selected,
}: NodeProps<ElastiCacheNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#C7131F"
      icon={ElastiCacheIcon}
      serviceLabel="ElastiCache"
      title={config.clusterName || 'Untitled'}
      tag={config.engine}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const ElastiCacheNode = memo(ElastiCacheNodeComponent);
