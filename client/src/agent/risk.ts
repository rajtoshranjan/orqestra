import { registry } from '@/services';

import type { AgentRiskLevel } from '@/api/agent';

/**
 * Merge the server's coarse op-type risk with fine-grained, client-only signal.
 * The cost/security profiles live on the frontend service definitions, so the
 * final risk grade is resolved here, at apply time.
 */
export function resolveOpRisk(
  serverRisk: AgentRiskLevel,
  opName: string,
  input: Record<string, unknown>,
): AgentRiskLevel {
  if (serverRisk === 'confirm') return 'confirm';

  if (opName === 'add_resource') {
    const service = registry.find(String(input.service_id ?? ''));
    if (service?.costProfile?.tier === 'high') return 'confirm';
  }

  return 'safe';
}
