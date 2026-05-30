import { memo } from 'react';
import type { NodeProps } from 'reactflow';
import { FunctionSquare } from 'lucide-react';
import type { ServiceValidationErrors } from '../types';
import type { LambdaConfig } from './types';
import { BaseServiceNode } from '@/components';

type LambdaNodeDataShape = {
  serviceId: string;
  label: string;
  config: LambdaConfig;
  validationErrors: ServiceValidationErrors;
};

function LambdaNodeComponent({
  data,
  selected,
}: NodeProps<LambdaNodeDataShape>) {
  const { config, validationErrors } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#3b82f6"
      icon={FunctionSquare}
      serviceLabel="AWS Lambda"
      title={config.functionName || 'Untitled'}
      tag={config.runtime}
      statsBar={
        <>
          <span>{config.memorySize}MB</span>
          <span className="opacity-30">•</span>
          <span>{config.timeout}s</span>
        </>
      }
    />
  );
}

export const LambdaNode = memo(LambdaNodeComponent);
