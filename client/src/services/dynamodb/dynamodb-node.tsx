import { memo } from 'react';
import type { NodeProps } from 'reactflow';

import type { ServiceValidationErrors } from '../types';
import type { DynamoDBConfig } from './types';

import { DynamodbIcon } from '@/components/aws-icons';
import { BaseServiceNode } from '@/components';

type DynamoDBNodeDataShape = {
  serviceId: string;
  label: string;
  config: DynamoDBConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function DynamoDBNodeComponent({
  data,
  selected,
}: NodeProps<DynamoDBNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#3b82f6"
      icon={DynamodbIcon}
      serviceLabel="DynamoDB Table"
      title={config.tableName || 'Untitled'}
      tag={`PK: ${config.hashKey}`}
      deploymentStatus={deploymentStatus}
      statsBar={
        <>
          <span>
            Billing:{' '}
            {config.billingMode === 'PAY_PER_REQUEST'
              ? 'On-Demand'
              : 'Provisioned'}
          </span>
        </>
      }
    />
  );
}

export const DynamoDBNode = memo(DynamoDBNodeComponent);
