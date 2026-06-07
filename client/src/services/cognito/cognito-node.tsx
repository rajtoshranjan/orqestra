import { memo } from 'react';
import type { NodeProps } from 'reactflow';

import type { ServiceValidationErrors } from '../types';
import type { CognitoConfig } from './types';

import { CognitoIcon } from '@/components/aws-icons';
import { BaseServiceNode } from '@/components';

type CognitoNodeDataShape = {
  serviceId: string;
  label: string;
  config: CognitoConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function CognitoNodeComponent({
  data,
  selected,
}: NodeProps<CognitoNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#BF5AF2"
      icon={CognitoIcon}
      serviceLabel="Cognito"
      title={config.userPoolName || 'Untitled'}
      tag={`MFA: ${config.mfaConfiguration}`}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const CognitoNode = memo(CognitoNodeComponent);
