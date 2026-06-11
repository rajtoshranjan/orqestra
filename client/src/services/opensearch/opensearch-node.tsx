import { memo } from 'react';
import type { NodeProps } from 'reactflow';

import type { ServiceValidationErrors } from '../types';
import type { OpenSearchConfig } from './types';

import { OpenSearchIcon } from '@/components/icons';
import { BaseServiceNode } from '@/components';

type OpenSearchNodeDataShape = {
  serviceId: string;
  label: string;
  config: OpenSearchConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function OpenSearchNodeComponent({
  data,
  selected,
}: NodeProps<OpenSearchNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#29B0D9"
      icon={OpenSearchIcon}
      serviceLabel="Amazon OpenSearch"
      title={config.domainName || 'Untitled'}
      tag={config.engineVersion}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const OpenSearchNode = memo(OpenSearchNodeComponent);
