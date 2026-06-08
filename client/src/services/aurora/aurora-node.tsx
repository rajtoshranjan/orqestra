import { memo } from 'react';
import type { NodeProps } from 'reactflow';

import type { ServiceValidationErrors } from '../types';
import type { AuroraConfig } from './types';

import { AuroraIcon } from '@/components/aws-icons';
import { BaseServiceNode } from '@/components';

type AuroraNodeDataShape = {
  serviceId: string;
  label: string;
  config: AuroraConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function AuroraNodeComponent({
  data,
  selected,
}: NodeProps<AuroraNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#A166FF"
      icon={AuroraIcon}
      serviceLabel="Aurora"
      title={config.clusterIdentifier || 'Untitled'}
      tag={config.engine}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const AuroraNode = memo(AuroraNodeComponent);
