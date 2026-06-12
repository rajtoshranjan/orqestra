import { memo } from 'react';

import { BaseServiceNode } from '@/components';
import { StepFunctionIcon } from '@/components/icons';

import type { ServiceValidationErrors } from '../types';
import type { StepFunctionConfig } from './types';
import type { NodeProps } from 'reactflow';

type StepFunctionNodeDataShape = {
  serviceId: string;
  label: string;
  config: StepFunctionConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function StepFunctionNodeComponent({
  data,
  selected,
}: NodeProps<StepFunctionNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#ec4899"
      icon={StepFunctionIcon}
      serviceLabel="Step Functions"
      title={config.stateMachineName || 'Untitled'}
      tag={config.type}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const StepFunctionNode = memo(StepFunctionNodeComponent);
