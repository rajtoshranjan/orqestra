import { memo } from 'react';
import type { NodeProps } from 'reactflow';

import type { ServiceValidationErrors } from '../types';
import type { FSxConfig } from './types';

import { FsxIcon } from '@/components/icons';
import { BaseServiceNode } from '@/components';

type FSxNodeDataShape = {
  serviceId: string;
  label: string;
  config: FSxConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function FSxNodeComponent({ data, selected }: NodeProps<FSxNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#7CC43D"
      icon={FsxIcon}
      serviceLabel="FSx"
      title={config.fileSystemName || 'Untitled'}
      tag={config.fileSystemType}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const FSxNode = memo(FSxNodeComponent);
