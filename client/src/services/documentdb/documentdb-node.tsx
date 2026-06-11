import { memo } from 'react';
import type { NodeProps } from 'reactflow';

import type { ServiceValidationErrors } from '../types';
import type { DocumentDbConfig } from './types';

import { DocumentDbIcon } from '@/components/icons';
import { BaseServiceNode } from '@/components';

type DocumentDbNodeDataShape = {
  serviceId: string;
  label: string;
  config: DocumentDbConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function DocumentDbNodeComponent({
  data,
  selected,
}: NodeProps<DocumentDbNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#29B0D9"
      icon={DocumentDbIcon}
      serviceLabel="Amazon DocumentDB"
      title={config.clusterIdentifier || 'Untitled'}
      tag={config.engineVersion}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const DocumentDbNode = memo(DocumentDbNodeComponent);
