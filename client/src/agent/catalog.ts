import type { AgentCatalogEntry } from '@/api/agent';
import { registry } from '@/services';

/**
 * Project the frontend service registry into the catalog the agent reasons
 * over. The rich service metadata lives only on the frontend, so the client
 * supplies this snapshot to the server when starting a conversation.
 */
export function buildAgentCatalog(): AgentCatalogEntry[] {
  return registry.getAll().map((service) => ({
    id: service.id,
    name: service.name,
    category: service.category,
    capabilities: service.capabilities,
    allowedParents: service.allowedParents,
    allowedRelationships: service.allowedRelationships,
    isContainer: service.isContainer ?? false,
    summary: service.aiHints?.summary,
    role: service.aiHints?.role,
    useCases: service.aiHints?.useCases,
  }));
}
