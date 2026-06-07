import type { BedrockConfig } from './types';

export function createDefaultBedrockConfig(index: number): BedrockConfig {
  return {
    agentName: `bedrock-agent-${index}`,
    foundationModel: 'anthropic.claude-3-sonnet',
    guardrailMode: 'NONE',
  };
}

export function getBedrockDisplayName(config: BedrockConfig): string {
  return config.agentName.trim() || 'Amazon Bedrock';
}
