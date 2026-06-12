import { memo } from 'react';

import { BaseServiceNode } from '@/components';
import { CloudWatchIcon } from '@/components/icons';

import type { ServiceValidationErrors } from '../types';
import type { CloudWatchConfig } from './types';
import type { NodeProps } from 'reactflow';

type CloudWatchNodeDataShape = {
  serviceId: string;
  label: string;
  config: CloudWatchConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function CloudWatchNodeComponent({
  data,
  selected,
}: NodeProps<CloudWatchNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#FF4F8B"
      icon={CloudWatchIcon}
      serviceLabel="CloudWatch"
      title={config.dashboardName || 'Untitled'}
      tag={`${config.retentionDays}d`}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const CloudWatchNode = memo(CloudWatchNodeComponent);
