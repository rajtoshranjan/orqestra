import { memo } from 'react';
import type { NodeProps } from 'reactflow';

import type { ServiceValidationErrors } from '../types';
import type { CodeDeployConfig } from './types';

import { CodeDeployIcon } from '@/components/icons';
import { BaseServiceNode } from '@/components';

type CodeDeployNodeDataShape = {
  serviceId: string;
  label: string;
  config: CodeDeployConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function CodeDeployNodeComponent({
  data,
  selected,
}: NodeProps<CodeDeployNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#BF5AF2"
      icon={CodeDeployIcon}
      serviceLabel="AWS CodeDeploy"
      title={config.applicationName || 'Untitled'}
      tag={config.computePlatform}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const CodeDeployNode = memo(CodeDeployNodeComponent);
