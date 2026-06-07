import { memo } from 'react';
import type { NodeProps } from 'reactflow';

import type { ServiceValidationErrors } from '../types';
import type { CodePipelineConfig } from './types';

import { CodePipelineIcon } from '@/components/aws-icons';
import { BaseServiceNode } from '@/components';

type CodePipelineNodeDataShape = {
  serviceId: string;
  label: string;
  config: CodePipelineConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function CodePipelineNodeComponent({
  data,
  selected,
}: NodeProps<CodePipelineNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#BF5AF2"
      icon={CodePipelineIcon}
      serviceLabel="AWS CodePipeline"
      title={config.pipelineName || 'Untitled'}
      tag={config.pipelineType}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const CodePipelineNode = memo(CodePipelineNodeComponent);
