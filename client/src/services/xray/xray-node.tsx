import { memo } from 'react';

import { BaseServiceNode } from '@/components';
import { XRayIcon } from '@/components/icons';

import type { ServiceValidationErrors } from '../types';
import type { XRayConfig } from './types';
import type { NodeProps } from 'reactflow';

type XRayNodeDataShape = {
  serviceId: string;
  label: string;
  config: XRayConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function XRayNodeComponent({ data, selected }: NodeProps<XRayNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#FF4F8B"
      icon={XRayIcon}
      serviceLabel="X-Ray"
      title={config.groupName || 'Untitled'}
      tag={`${config.samplingRate}%`}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const XRayNode = memo(XRayNodeComponent);
