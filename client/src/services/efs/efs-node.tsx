import { memo } from 'react';

import { BaseServiceNode } from '@/components';
import { EfsIcon } from '@/components/icons';

import type { ServiceValidationErrors } from '../types';
import type { EFSConfig } from './types';
import type { NodeProps } from 'reactflow';

type EFSNodeDataShape = {
  serviceId: string;
  label: string;
  config: EFSConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function EFSNodeComponent({ data, selected }: NodeProps<EFSNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#3b82f6"
      icon={EfsIcon}
      serviceLabel="EFS File System"
      title={config.creationToken || 'Untitled'}
      tag={config.performanceMode}
      deploymentStatus={deploymentStatus}
      statsBar={
        <>
          <span>APs: {config.accessPoints?.length || 0}</span>
        </>
      }
    />
  );
}

export const EFSNode = memo(EFSNodeComponent);
