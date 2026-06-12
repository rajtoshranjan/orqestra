import { memo } from 'react';

import { BaseServiceNode } from '@/components';
import { NatGatewayIcon } from '@/components/icons';

import type { ServiceValidationErrors } from '../types';
import type { NatGatewayConfig } from './types';
import type { NodeProps } from 'reactflow';

type NatGatewayNodeDataShape = {
  serviceId: string;
  label: string;
  config: NatGatewayConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function NatGatewayNodeComponent({
  data,
  selected,
}: NodeProps<NatGatewayNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#29B0D9"
      icon={NatGatewayIcon}
      serviceLabel="NAT GW"
      title={config.natGatewayName || 'Untitled'}
      tag={config.connectivityType}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const NatGatewayNode = memo(NatGatewayNodeComponent);
