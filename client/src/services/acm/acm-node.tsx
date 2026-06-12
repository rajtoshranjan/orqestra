import { memo } from 'react';

import { BaseServiceNode } from '@/components';
import { AcmIcon } from '@/components/icons';

import type { ServiceValidationErrors } from '../types';
import type { AcmConfig } from './types';
import type { NodeProps } from 'reactflow';

type AcmNodeDataShape = {
  serviceId: string;
  label: string;
  config: AcmConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function AcmNodeComponent({ data, selected }: NodeProps<AcmNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#DD344C"
      icon={AcmIcon}
      serviceLabel="AWS ACM"
      title={config.certificateName || 'Untitled'}
      tag={config.domainName}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const AcmNode = memo(AcmNodeComponent);
