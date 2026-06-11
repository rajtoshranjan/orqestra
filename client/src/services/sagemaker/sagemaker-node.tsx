import { memo } from 'react';
import type { NodeProps } from 'reactflow';

import type { ServiceValidationErrors } from '../types';
import type { SageMakerConfig } from './types';

import { SageMakerIcon } from '@/components/icons';
import { BaseServiceNode } from '@/components';

type SageMakerNodeDataShape = {
  serviceId: string;
  label: string;
  config: SageMakerConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function SageMakerNodeComponent({
  data,
  selected,
}: NodeProps<SageMakerNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#BF5AF2"
      icon={SageMakerIcon}
      serviceLabel="Amazon SageMaker"
      title={config.notebookName || 'Untitled'}
      tag={config.instanceType}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const SageMakerNode = memo(SageMakerNodeComponent);
