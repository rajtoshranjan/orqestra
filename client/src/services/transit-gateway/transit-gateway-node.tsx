import { memo } from 'react';
import type { NodeProps } from 'reactflow';

import type { ServiceValidationErrors } from '../types';
import type { TransitGatewayConfig } from './types';

import { TransitGatewayIcon } from '@/components/icons';
import { BaseServiceNode } from '@/components';

type TransitGatewayNodeDataShape = {
  serviceId: string;
  label: string;
  config: TransitGatewayConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function TransitGatewayNodeComponent({
  data,
  selected,
}: NodeProps<TransitGatewayNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#29B0D9"
      icon={TransitGatewayIcon}
      serviceLabel="Transit Gateway"
      title={config.transitGatewayName || 'Untitled'}
      tag={`ASN: ${config.amazonSideAsn}`}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const TransitGatewayNode = memo(TransitGatewayNodeComponent);
