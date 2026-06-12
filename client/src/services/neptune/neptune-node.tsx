import { memo } from 'react';

import { BaseServiceNode } from '@/components';
import { NeptuneIcon } from '@/components/icons';

import type { ServiceValidationErrors } from '../types';
import type { NeptuneConfig } from './types';
import type { NodeProps } from 'reactflow';

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
