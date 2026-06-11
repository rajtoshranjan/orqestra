import { memo } from 'react';
import type { NodeProps } from 'reactflow';

import type { ServiceValidationErrors } from '../types';
import type { RDSConfig } from './types';

import { RdsIcon } from '@/components/icons';
import { BaseServiceNode } from '@/components';

type RDSNodeDataShape = {
  serviceId: string;
  label: string;
  config: RDSConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function RDSNodeComponent({ data, selected }: NodeProps<RDSNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#29B0D9"
      icon={RdsIcon}
      serviceLabel="RDS"
      title={config.instanceIdentifier || 'Untitled'}
      tag={config.engine}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const RDSNode = memo(RDSNodeComponent);
