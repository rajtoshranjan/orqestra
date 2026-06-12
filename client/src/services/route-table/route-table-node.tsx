import { memo } from 'react';

import { BaseServiceNode } from '@/components';
import { RouteTableIcon } from '@/components/icons';

import type { ServiceValidationErrors } from '../types';
import type { RouteTableConfig } from './types';
import type { NodeProps } from 'reactflow';

type RouteTableNodeDataShape = {
  serviceId: string;
  label: string;
  config: RouteTableConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function RouteTableNodeComponent({
  data,
  selected,
}: NodeProps<RouteTableNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#29B0D9"
      icon={RouteTableIcon}
      serviceLabel="Route Table"
      title={config.routeTableName || 'Untitled'}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const RouteTableNode = memo(RouteTableNodeComponent);
