import { memo } from 'react';

import { BaseServiceNode } from '@/components';
import { SecretsManagerIcon } from '@/components/icons';

import type { ServiceValidationErrors } from '../types';
import type { SecretsManagerConfig } from './types';
import type { NodeProps } from 'reactflow';

type SecretsManagerNodeDataShape = {
  serviceId: string;
  label: string;
  config: SecretsManagerConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function SecretsManagerNodeComponent({
  data,
  selected,
}: NodeProps<SecretsManagerNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#DD344C"
      icon={SecretsManagerIcon}
      serviceLabel="Secrets Manager"
      title={config.secretName || 'Untitled'}
      tag={config.rotationEnabled ? 'Rotation On' : 'Rotation Off'}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const SecretsManagerNode = memo(SecretsManagerNodeComponent);
