import { memo } from 'react';
import type { NodeProps } from 'reactflow';

import type { ServiceValidationErrors } from '../types';
import type { EventBridgeConfig } from './types';

import { EventBridgeIcon } from '@/components/icons';
import { BaseServiceNode } from '@/components';

type EventBridgeNodeDataShape = {
  serviceId: string;
  label: string;
  config: EventBridgeConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function EventBridgeNodeComponent({
  data,
  selected,
}: NodeProps<EventBridgeNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#ec4899"
      icon={EventBridgeIcon}
      serviceLabel="EventBridge"
      title={config.ruleName || 'Untitled'}
      tag={config.scheduleExpression || 'Event Pattern'}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const EventBridgeNode = memo(EventBridgeNodeComponent);
