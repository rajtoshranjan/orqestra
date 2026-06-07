import { memo } from 'react';
import type { NodeProps } from 'reactflow';

import type { ServiceValidationErrors } from '../types';
import type { GuardDutyConfig } from './types';

import { GuardDutyIcon } from '@/components/aws-icons';
import { BaseServiceNode } from '@/components';

type GuardDutyNodeDataShape = {
  serviceId: string;
  label: string;
  config: GuardDutyConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function GuardDutyNodeComponent({
  data,
  selected,
}: NodeProps<GuardDutyNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#DD344C"
      icon={GuardDutyIcon}
      serviceLabel="Amazon GuardDuty"
      title={config.detectorName || 'Untitled'}
      tag={config.findingPublishingFrequency.replace('_', ' ')}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const GuardDutyNode = memo(GuardDutyNodeComponent);
