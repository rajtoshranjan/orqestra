import { memo } from 'react';
import type { NodeProps } from 'reactflow';

import type { ServiceValidationErrors } from '../types';
import type { NeptuneConfig } from './types';

import { NeptuneIcon } from '@/components/icons';
import { BaseServiceNode } from '@/components';

type NeptuneNodeDataShape = {
  serviceId: string;
  label: string;
  config: NeptuneConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function NeptuneNodeComponent({
  data,
  selected,
}: NodeProps<NeptuneNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#29B0D9"
      icon={NeptuneIcon}
      serviceLabel="Amazon Neptune"
      title={config.clusterIdentifier || 'Untitled'}
      tag={config.engineVersion}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const NeptuneNode = memo(NeptuneNodeComponent);
