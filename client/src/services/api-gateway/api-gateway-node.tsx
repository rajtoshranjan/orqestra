import { memo } from 'react';

import { BaseServiceNode } from '@/components';
import { ApiGatewayIcon } from '@/components/icons';

import type { ServiceValidationErrors } from '../types';
import type { APIGatewayConfig } from './types';
import type { NodeProps } from 'reactflow';

type APIGatewayNodeDataShape = {
  serviceId: string;
  label: string;
  config: APIGatewayConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function APIGatewayNodeComponent({
  data,
  selected,
}: NodeProps<APIGatewayNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#A166FF"
      icon={ApiGatewayIcon}
      serviceLabel={`API Gateway (${config.apiType || 'HTTP'})`}
      title={config.apiName || 'Untitled'}
      tag={`${config.routes?.length || 0} Routes`}
      deploymentStatus={deploymentStatus}
      statsBar={
        <>
          <span>Stage: {config.stageName}</span>
        </>
      }
    />
  );
}

export const APIGatewayNode = memo(APIGatewayNodeComponent);
