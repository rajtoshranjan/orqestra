import { memo } from 'react';
import type { NodeProps } from 'reactflow';

import type { ServiceValidationErrors } from '../types';
import type { ECRConfig } from './types';

import { EcrIcon } from '@/components/icons';
import { BaseServiceNode } from '@/components';

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
