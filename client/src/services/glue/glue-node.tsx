import { memo } from 'react';
import type { NodeProps } from 'reactflow';

import type { ServiceValidationErrors } from '../types';
import type { GlueConfig } from './types';

import { GlueIcon } from '@/components/icons';
import { BaseServiceNode } from '@/components';

type GlueNodeDataShape = {
  serviceId: string;
  label: string;
  config: GlueConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function GlueNodeComponent({ data, selected }: NodeProps<GlueNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#BF5AF2"
      icon={GlueIcon}
      serviceLabel="AWS Glue"
      title={config.databaseName || 'Untitled'}
      tag={config.dataSourceType}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const GlueNode = memo(GlueNodeComponent);
