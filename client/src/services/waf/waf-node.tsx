import { memo } from 'react';
import type { NodeProps } from 'reactflow';

import type { ServiceValidationErrors } from '../types';
import type { WafConfig } from './types';

import { WafIcon } from '@/components/icons';
import { BaseServiceNode } from '@/components';

type WafNodeDataShape = {
  serviceId: string;
  label: string;
  config: WafConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function WafNodeComponent({ data, selected }: NodeProps<WafNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#DD344C"
      icon={WafIcon}
      serviceLabel="AWS WAF"
      title={config.webAclName || 'Untitled'}
      tag={config.scope}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const WafNode = memo(WafNodeComponent);
