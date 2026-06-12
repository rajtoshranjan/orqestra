import { memo } from 'react';

import { BaseServiceNode } from '@/components';
import { AthenaIcon } from '@/components/icons';

import type { ServiceValidationErrors } from '../types';
import type { AthenaConfig } from './types';
import type { NodeProps } from 'reactflow';

type AthenaNodeDataShape = {
  serviceId: string;
  label: string;
  config: AthenaConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function AthenaNodeComponent({
  data,
  selected,
}: NodeProps<AthenaNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#BF5AF2"
      icon={AthenaIcon}
      serviceLabel="Amazon Athena"
      title={config.workGroupName || 'Untitled'}
      tag={config.engineVersion}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const AthenaNode = memo(AthenaNodeComponent);
