import { memo } from 'react';
import type { NodeProps } from 'reactflow';

import type { ServiceValidationErrors } from '../types';
import type { ElasticBeanstalkConfig } from './types';

import { ElasticBeanstalkIcon } from '@/components/icons';
import { BaseServiceNode } from '@/components';

type ElasticBeanstalkNodeDataShape = {
  serviceId: string;
  label: string;
  config: ElasticBeanstalkConfig;
  validationErrors: ServiceValidationErrors;
  deploymentStatus?: 'not_deployed' | 'deployed' | 'dirty';
};

function ElasticBeanstalkNodeComponent({
  data,
  selected,
}: NodeProps<ElasticBeanstalkNodeDataShape>) {
  const { config, validationErrors, deploymentStatus = 'not_deployed' } = data;
  const errorCount = Object.values(validationErrors).filter(Boolean).length;
  const hasErrors = errorCount > 0;

  return (
    <BaseServiceNode
      selected={selected}
      hasErrors={hasErrors}
      errorCount={errorCount}
      accentColor="#FF9900"
      icon={ElasticBeanstalkIcon}
      serviceLabel="AWS Elastic Beanstalk"
      title={config.applicationName || 'Untitled'}
      tag={config.environmentTier}
      deploymentStatus={deploymentStatus}
    />
  );
}

export const ElasticBeanstalkNode = memo(ElasticBeanstalkNodeComponent);
