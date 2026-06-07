export type BedrockGuardrailMode = 'NONE' | 'ATTACHED';

export type BedrockConfig = {
  agentName: string;
  foundationModel: string;
  guardrailMode: BedrockGuardrailMode;
};
