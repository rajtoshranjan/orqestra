import { memo } from 'react';

import { BaseServiceNode } from '@/components';
import { SesIcon } from '@/components/icons';

import type { ServiceValidationErrors } from '../types';
import type { SesConfig } from './types';
import type { NodeProps } from 'reactflow';

type SesNodeDataShape = {
  serviceId: string;
  label: string;
  config: SesConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function SesNodeComponent({ data, selected }: NodeProps<SesNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#FF9900"
      icon={SesIcon}
      serviceLabel="Amazon SES"
      title={config.identityName || 'Untitled'}
      tag={config.identityType}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const SesNode = memo(SesNodeComponent);
