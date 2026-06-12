import { memo } from 'react';

import { BaseServiceNode } from '@/components';
import { EcrIcon } from '@/components/icons';

import type { ServiceValidationErrors } from '../types';
import type { ECRConfig } from './types';
import type { NodeProps } from 'reactflow';

type ECRNodeDataShape = {
  serviceId: string;
  label: string;
  config: ECRConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function ECRNodeComponent({ data, selected }: NodeProps<ECRNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#FF9900"
      icon={EcrIcon}
      serviceLabel="ECR Repository"
      title={config.repositoryName || 'Untitled'}
      tag={config.imageTagMutability}
      deploymentStatus={deploymentStatus}
      statsBar={
        <>
          <span>Scan: {config.scanOnPush ? 'On' : 'Off'}</span>
        </>
      }
    />
  );
}

export const ECRNode = memo(ECRNodeComponent);
