import { memo } from 'react';
import type { NodeProps } from 'reactflow';

import type { ServiceValidationErrors } from '../types';
import type { EBSConfig } from './types';

import { EbsIcon } from '@/components/aws-icons';
import { BaseServiceNode } from '@/components';

type EBSNodeDataShape = {
  serviceId: string;
  label: string;
  config: EBSConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function EBSNodeComponent({ data, selected }: NodeProps<EBSNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#7CC43D"
      icon={EbsIcon}
      serviceLabel="EBS"
      title={config.volumeName || 'Untitled'}
      tag={config.volumeType}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const EBSNode = memo(EBSNodeComponent);
