import { memo } from 'react';

import { BaseServiceNode } from '@/components';
import { CloudTrailIcon } from '@/components/icons';

import type { ServiceValidationErrors } from '../types';
import type { CloudTrailConfig } from './types';
import type { NodeProps } from 'reactflow';

type CloudTrailNodeDataShape = {
  serviceId: string;
  label: string;
  config: CloudTrailConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function CloudTrailNodeComponent({
  data,
  selected,
}: NodeProps<CloudTrailNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#FF4F8B"
      icon={CloudTrailIcon}
      serviceLabel="AWS CloudTrail"
      title={config.trailName || 'Untitled'}
      tag={config.managementEvents}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const CloudTrailNode = memo(CloudTrailNodeComponent);
