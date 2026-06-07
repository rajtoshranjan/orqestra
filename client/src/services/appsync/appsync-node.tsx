import { memo } from 'react';
import type { NodeProps } from 'reactflow';

import type { ServiceValidationErrors } from '../types';
import type { AppSyncConfig } from './types';

import { AppSyncIcon } from '@/components/aws-icons';
import { BaseServiceNode } from '@/components';

type AppSyncNodeDataShape = {
  serviceId: string;
  label: string;
  config: AppSyncConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function AppSyncNodeComponent({
  data,
  selected,
}: NodeProps<AppSyncNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#BF5AF2"
      icon={AppSyncIcon}
      serviceLabel="AWS AppSync"
      title={config.apiName || 'Untitled'}
      tag={config.apiType}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const AppSyncNode = memo(AppSyncNodeComponent);
