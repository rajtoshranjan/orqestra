import { memo } from 'react';

import { BaseServiceNode } from '@/components';
import { Route53Icon } from '@/components/icons';

import type { ServiceValidationErrors } from '../types';
import type { Route53Config } from './types';
import type { NodeProps } from 'reactflow';

type Route53NodeDataShape = {
  serviceId: string;
  label: string;
  config: Route53Config;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function Route53NodeComponent({
  data,
  selected,
}: NodeProps<Route53NodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#29B0D9"
      icon={Route53Icon}
      serviceLabel="Route 53"
      title={config.hostedZoneName || 'Untitled'}
      tag={config.zoneType}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const Route53Node = memo(Route53NodeComponent);
