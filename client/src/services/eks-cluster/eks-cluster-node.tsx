import { memo } from 'react';

import { BaseServiceNode } from '@/components';
import { EksIcon } from '@/components/icons';

import type { ServiceValidationErrors } from '../types';
import type { EksClusterConfig } from './types';
import type { NodeProps } from 'reactflow';

type EksClusterNodeDataShape = {
  serviceId: string;
  label: string;
  config: EksClusterConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function EksClusterNodeComponent({
  data,
  selected,
}: NodeProps<EksClusterNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#FF9900"
      icon={EksIcon}
      serviceLabel="Amazon EKS"
      title={config.clusterName || 'Untitled'}
      tag={`k8s ${config.kubernetesVersion}`}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const EksClusterNode = memo(EksClusterNodeComponent);
