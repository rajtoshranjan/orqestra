import { memo } from 'react';

import { BaseServiceNode } from '@/components';
import { IamRoleIcon } from '@/components/icons';

import type { ServiceValidationErrors } from '../types';
import type { IAMRoleConfig } from './types';
import type { NodeProps } from 'reactflow';

type IAMRoleNodeDataShape = {
  serviceId: string;
  label: string;
  config: IAMRoleConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function IAMRoleNodeComponent({
  data,
  selected,
}: NodeProps<IAMRoleNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#DD344C"
      icon={IamRoleIcon}
      serviceLabel="IAM Role"
      title={config.roleName || 'Untitled'}
      tag={`${config.managedPolicyArns?.length || 0} Managed`}
      deploymentStatus={deploymentStatus}
      statsBar={
        <>
          <span>{config.inlinePolicies?.length || 0} Inline</span>
        </>
      }
    />
  );
}

export const IAMRoleNode = memo(IAMRoleNodeComponent);
