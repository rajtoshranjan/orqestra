import { memo } from 'react';
import type { NodeProps } from 'reactflow';

import type { ServiceValidationErrors } from '../types';
import type { EC2Config } from './types';

import { Ec2Icon } from '@/components/aws-icons';
import { BaseServiceNode } from '@/components';

type EC2NodeDataShape = {
  serviceId: string;
  label: string;
  config: EC2Config;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function EC2NodeComponent({ data, selected }: NodeProps<EC2NodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#FF9900"
      icon={Ec2Icon}
      serviceLabel="EC2"
      title={config.instanceName || 'Untitled'}
      tag={config.instanceType}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const EC2Node = memo(EC2NodeComponent);
