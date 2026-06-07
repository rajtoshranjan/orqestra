import { memo } from 'react';
import type { NodeProps } from 'reactflow';
import { ShieldCheck } from 'lucide-react';
import type { ServiceValidationErrors } from '../types';
import type { AccountConfig } from './types';
import { BaseContainerNode } from '@/components';

type AccountNodeData = {
  serviceId: string;
  label: string;
  config: AccountConfig;
  validationErrors: ServiceValidationErrors;
  isDragOver?: boolean;
  onToggleCollapse?: () => void;
};

function AccountNodeComponent({
  id,
  data,
  selected,
}: NodeProps<AccountNodeData>) {
  const { config, isDragOver, onToggleCollapse } = data;

  return (
    <BaseContainerNode
      id={id}
      selected={selected}
      accentColor="#6366f1"
      icon={ShieldCheck}
      serviceLabel="AWS Account"
      title={config.accountId || '123456789012'}
      isCollapsed={config.isCollapsed}
      onToggleCollapse={onToggleCollapse}
      borderStyle="solid"
      isDragOver={isDragOver}
    />
  );
}

export const AccountNode = memo(AccountNodeComponent);
