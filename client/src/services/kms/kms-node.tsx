import { memo } from 'react';
import type { NodeProps } from 'reactflow';

import type { ServiceValidationErrors } from '../types';
import type { KMSConfig } from './types';

import { KmsIcon } from '@/components/aws-icons';
import { BaseServiceNode } from '@/components';

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
