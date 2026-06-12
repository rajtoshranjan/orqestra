import { memo } from 'react';

import { BaseServiceNode } from '@/components';
import { NetworkAclIcon } from '@/components/icons';

import type { ServiceValidationErrors } from '../types';
import type { NetworkAclConfig } from './types';
import type { NodeProps } from 'reactflow';

type NetworkAclNodeDataShape = {
  serviceId: string;
  label: string;
  config: NetworkAclConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function NetworkAclNodeComponent({
  data,
  selected,
}: NodeProps<NetworkAclNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#29B0D9"
      icon={NetworkAclIcon}
      serviceLabel="Network ACL"
      title={config.aclName || 'Untitled'}
      tag={config.defaultAction}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const NetworkAclNode = memo(NetworkAclNodeComponent);
