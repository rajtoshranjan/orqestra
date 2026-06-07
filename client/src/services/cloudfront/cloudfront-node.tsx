import { memo } from 'react';
import type { NodeProps } from 'reactflow';

import type { ServiceValidationErrors } from '../types';
import type { CloudFrontConfig } from './types';

import { CloudFrontIcon } from '@/components/aws-icons';
import { BaseServiceNode } from '@/components';

type CloudFrontNodeDataShape = {
  serviceId: string;
  label: string;
  config: CloudFrontConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function CloudFrontNodeComponent({
  data,
  selected,
}: NodeProps<CloudFrontNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#8C4FFF"
      icon={CloudFrontIcon}
      serviceLabel="Amazon CloudFront"
      title={config.distributionName || 'Untitled'}
      tag={config.priceClass.replace('PriceClass_', 'Price ')}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const CloudFrontNode = memo(CloudFrontNodeComponent);
