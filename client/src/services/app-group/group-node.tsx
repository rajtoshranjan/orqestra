import { memo } from 'react';
import type { NodeProps } from 'reactflow';
import { Folder } from 'lucide-react';
import type { ServiceValidationErrors } from '../types';
import type { AppGroupConfig } from './types';
import { BaseContainerNode } from '@/components';

type AppGroupNodeData = {
  serviceId: string;
  label: string;
  config: AppGroupConfig;
  validationErrors: ServiceValidationErrors;
  isDragOver?: boolean;
  onToggleCollapse?: () => void;
};

function AppGroupNodeComponent({
  id,
  data,
  selected,
}: NodeProps<AppGroupNodeData>) {
  const { config, isDragOver, onToggleCollapse } = data;

  return (
    <BaseContainerNode
      id={id}
      selected={selected}
      accentColor="#f59e0b"
      icon={Folder}
      serviceLabel="App Group"
      title={config.groupName || 'Untitled Group'}
      isCollapsed={config.isCollapsed}
      onToggleCollapse={onToggleCollapse}
      borderStyle="dashed"
      isDragOver={isDragOver}
    />
  );
}

export const AppGroupNode = memo(AppGroupNodeComponent);
