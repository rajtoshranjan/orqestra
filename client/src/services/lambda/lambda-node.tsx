import { memo } from 'react';
import type { NodeProps } from 'reactflow';

import type { ServiceValidationErrors } from '../types';
import type { LambdaConfig } from './types';

import { LambdaIcon } from '@/components/icons';
import { BaseServiceNode } from '@/components';

type LambdaNodeDataShape = {
  serviceId: string;
  label: string;
  config: LambdaConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function LambdaNodeComponent({
  data,
  selected,
}: NodeProps<LambdaNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#FF9900"
      icon={LambdaIcon}
      serviceLabel={`AWS Lambda (${config.packageType || 'Zip'})`}
      title={config.functionName || 'Untitled'}
      tag={config.runtime || 'Container'}
      deploymentStatus={deploymentStatus}
      statsBar={
        <>
          <span>{config.memorySize}MB</span>
          <span className="opacity-30">•</span>
          <span>{config.timeout}s</span>
          <span className="opacity-30">•</span>
          <span>{config.architecture}</span>
        </>
      }
    />
  );
}

export const LambdaNode = memo(LambdaNodeComponent);
