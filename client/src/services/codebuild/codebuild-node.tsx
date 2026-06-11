import { memo } from 'react';
import type { NodeProps } from 'reactflow';

import type { ServiceValidationErrors } from '../types';
import type { CodeBuildConfig } from './types';

import { CodeBuildIcon } from '@/components/icons';
import { BaseServiceNode } from '@/components';

type CodeBuildNodeDataShape = {
  serviceId: string;
  label: string;
  config: CodeBuildConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function CodeBuildNodeComponent({
  data,
  selected,
}: NodeProps<CodeBuildNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#BF5AF2"
      icon={CodeBuildIcon}
      serviceLabel="AWS CodeBuild"
      title={config.projectName || 'Untitled'}
      tag={config.computeType.replace('BUILD_GENERAL1_', '')}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const CodeBuildNode = memo(CodeBuildNodeComponent);
