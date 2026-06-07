import { memo } from 'react';
import type { NodeProps } from 'reactflow';

import type { ServiceValidationErrors } from '../types';
import type { LambdaLayerConfig } from './types';

import { LambdaLayerIcon } from '@/components/aws-icons';
import { BaseServiceNode } from '@/components';

type LambdaLayerNodeDataShape = {
  serviceId: string;
  label: string;
  config: LambdaLayerConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function LambdaLayerNodeComponent({
  data,
  selected,
}: NodeProps<LambdaLayerNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#FF9900"
      icon={LambdaLayerIcon}
      serviceLabel="Lambda Layer"
      title={config.layerName || 'Untitled'}
      tag={`${config.compatibleRuntimes?.length || 0} Runtimes`}
      deploymentStatus={deploymentStatus}
      statsBar={
        <>
          <span>{config.compatibleArchitectures?.join(', ')}</span>
        </>
      }
    />
  );
}

export const LambdaLayerNode = memo(LambdaLayerNodeComponent);
