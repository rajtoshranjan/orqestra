import { memo } from 'react';
import type { NodeProps } from 'reactflow';

import type { ServiceValidationErrors } from '../types';
import type { SecurityGroupConfig } from './types';

import { SecurityGroupIcon } from '@/components/icons';
import { BaseServiceNode } from '@/components';

type SecurityGroupNodeDataShape = {
  serviceId: string;
  label: string;
  config: SecurityGroupConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function SecurityGroupNodeComponent({
  data,
  selected,
}: NodeProps<SecurityGroupNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#3F8624"
      icon={SecurityGroupIcon}
      serviceLabel="Security Group"
      title={config.groupName || 'Untitled'}
      tag={`${config.ingressRules?.length || 0} Inbound`}
      deploymentStatus={deploymentStatus}
      statsBar={
        <>
          <span>{config.egressRules?.length || 0} Outbound</span>
        </>
      }
    />
  );
}

export const SecurityGroupNode = memo(SecurityGroupNodeComponent);
