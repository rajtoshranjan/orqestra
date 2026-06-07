export type EventBridgeConfig = {
  ruleName: string;
  scheduleExpression?: string;
  eventPattern?: string;
};
