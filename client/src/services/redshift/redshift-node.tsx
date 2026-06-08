import { memo } from 'react';
import type { NodeProps } from 'reactflow';

import type { ServiceValidationErrors } from '../types';
import type { RedshiftConfig } from './types';

import { RedshiftIcon } from '@/components/aws-icons';
import { BaseServiceNode } from '@/components';

type RedshiftNodeDataShape = {
  serviceId: string;
  label: string;
  config: RedshiftConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function RedshiftNodeComponent({
  data,
  selected,
}: NodeProps<RedshiftNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#29B0D9"
      icon={RedshiftIcon}
      serviceLabel="Redshift"
      title={config.clusterIdentifier || 'Untitled'}
      tag={config.nodeType}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const RedshiftNode = memo(RedshiftNodeComponent);
