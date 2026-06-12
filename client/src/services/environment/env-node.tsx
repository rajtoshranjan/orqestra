import { memo } from 'react';

import { Layers } from 'lucide-react';

import { BaseContainerNode } from '@/components';

import type { ServiceValidationErrors } from '../types';
import type { EnvironmentConfig } from './types';
import type { NodeProps } from 'reactflow';

type EnvNodeData = {
  serviceId: string;
  label: string;
  config: EnvironmentConfig;
  validationErrors: ServiceValidationErrors;
  isDragOver?: boolean;
  onToggleCollapse?: () => void;
};

function EnvNodeComponent({ id, data, selected }: NodeProps<EnvNodeData>) {
  const { config, isDragOver, onToggleCollapse } = data;

  return (
    <BaseContainerNode
      id={id}
      selected={selected}
      accentColor="#8b5cf6"
      icon={Layers}
      serviceLabel="Environment"
      title={config.envName || 'dev'}
      isCollapsed={config.isCollapsed}
      onToggleCollapse={onToggleCollapse}
      borderStyle="solid"
      isDragOver={isDragOver}
    />
  );
}

export const EnvNode = memo(EnvNodeComponent);
