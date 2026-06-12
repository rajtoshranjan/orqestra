import { memo } from 'react';

import { BaseServiceNode } from '@/components';
import { AppRunnerIcon } from '@/components/icons';

import type { ServiceValidationErrors } from '../types';
import type { AppRunnerConfig } from './types';
import type { NodeProps } from 'reactflow';

type AppRunnerNodeDataShape = {
  serviceId: string;
  label: string;
  config: AppRunnerConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function AppRunnerNodeComponent({
  data,
  selected,
}: NodeProps<AppRunnerNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#FF9900"
      icon={AppRunnerIcon}
      serviceLabel="AWS App Runner"
      title={config.serviceName || 'Untitled'}
      tag={config.cpu}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const AppRunnerNode = memo(AppRunnerNodeComponent);
