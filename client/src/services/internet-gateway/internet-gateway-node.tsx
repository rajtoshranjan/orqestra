import { memo } from 'react';
import type { NodeProps } from 'reactflow';

import type { ServiceValidationErrors } from '../types';
import type { InternetGatewayConfig } from './types';

import { InternetGatewayIcon } from '@/components/aws-icons';
import { BaseServiceNode } from '@/components';

type InternetGatewayNodeDataShape = {
  serviceId: string;
  label: string;
  config: InternetGatewayConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function InternetGatewayNodeComponent({
  data,
  selected,
}: NodeProps<InternetGatewayNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#29B0D9"
      icon={InternetGatewayIcon}
      serviceLabel="IGW"
      title={config.gatewayName || 'Untitled'}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const InternetGatewayNode = memo(InternetGatewayNodeComponent);
