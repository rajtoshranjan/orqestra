import { memo } from 'react';

import { BaseServiceNode } from '@/components';
import { KmsIcon } from '@/components/icons';

import type { ServiceValidationErrors } from '../types';
import type { KMSConfig } from './types';
import type { NodeProps } from 'reactflow';

type KMSNodeDataShape = {
  serviceId: string;
  label: string;
  config: KMSConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function KMSNodeComponent({ data, selected }: NodeProps<KMSNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#DD344C"
      icon={KmsIcon}
      serviceLabel="KMS"
      title={config.keyAlias || 'Untitled'}
      tag={config.keyUsage}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const KMSNode = memo(KMSNodeComponent);
