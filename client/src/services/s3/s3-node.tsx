import { memo } from 'react';
import type { NodeProps } from 'reactflow';

import type { ServiceValidationErrors } from '../types';
import type { S3Config } from './types';

import { S3Icon } from '@/components/icons';
import { BaseServiceNode } from '@/components';

type S3NodeDataShape = {
  serviceId: string;
  label: string;
  config: S3Config;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function S3NodeComponent({ data, selected }: NodeProps<S3NodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#3b82f6"
      icon={S3Icon}
      serviceLabel="S3 Bucket"
      title={config.bucketName || 'Untitled'}
      tag={config.versioning ? 'Versioning On' : 'Versioning Off'}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const S3Node = memo(S3NodeComponent);
