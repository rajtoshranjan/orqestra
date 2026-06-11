import { memo } from 'react';
import type { NodeProps } from 'reactflow';

import type { ServiceValidationErrors } from '../types';
import type { BedrockConfig } from './types';

import { BedrockIcon } from '@/components/icons';
import { BaseServiceNode } from '@/components';

type BedrockNodeDataShape = {
  serviceId: string;
  label: string;
  config: BedrockConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function BedrockNodeComponent({
  data,
  selected,
}: NodeProps<BedrockNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#BF5AF2"
      icon={BedrockIcon}
      serviceLabel="Amazon Bedrock"
      title={config.agentName || 'Untitled'}
      tag={config.guardrailMode === 'ATTACHED' ? 'Guardrail' : 'No Guardrail'}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const BedrockNode = memo(BedrockNodeComponent);
