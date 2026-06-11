import { memo } from 'react';
import type { NodeProps } from 'reactflow';

import type { ServiceValidationErrors } from '../types';
import type { VpcEndpointConfig } from './types';

import { VpcEndpointIcon } from '@/components/icons';
import { BaseServiceNode } from '@/components';

type VpcEndpointNodeDataShape = {
  serviceId: string;
  label: string;
  config: VpcEndpointConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function VpcEndpointNodeComponent({
  data,
  selected,
}: NodeProps<VpcEndpointNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#29B0D9"
      icon={VpcEndpointIcon}
      serviceLabel="VPC Endpoint"
      title={config.endpointName || 'Untitled'}
      tag={config.endpointType}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const VpcEndpointNode = memo(VpcEndpointNodeComponent);
