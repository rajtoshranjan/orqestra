import { memo } from 'react';
import type { NodeProps } from 'reactflow';

import type { ServiceValidationErrors } from '../types';
import type { SsmConfig } from './types';

import { SsmIcon } from '@/components/aws-icons';
import { BaseServiceNode } from '@/components';

type SsmNodeDataShape = {
  serviceId: string;
  label: string;
  config: SsmConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function SsmNodeComponent({ data, selected }: NodeProps<SsmNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#DD344C"
      icon={SsmIcon}
      serviceLabel="SSM Parameter"
      title={config.parameterName || 'Untitled'}
      tag={config.parameterType}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const SsmNode = memo(SsmNodeComponent);
