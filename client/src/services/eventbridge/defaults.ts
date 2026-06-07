import type { EventBridgeConfig } from './types';

export function createDefaultEventBridgeConfig(
  index: number,
): EventBridgeConfig {
  return {
    ruleName: `event-rule-${index}`,
    scheduleExpression: 'rate(5 minutes)',
    eventPattern: '',
  };
}

export function getEventBridgeDisplayName(config: EventBridgeConfig): string {
  return config.ruleName.trim() || 'EventBridge Rule';
}
