import type { AgentOp } from '@/api/agent';

/** Icon kinds for agent activity rows (mapped to lucide icons in the panel). */
export type AgentOpIcon =
  | 'add'
  | 'connect'
  | 'configure'
  | 'parent'
  | 'remove'
  | 'check'
  | 'cost'
  | 'info';

export type OpDescription = { icon: AgentOpIcon; label: string };

const asString = (value: unknown): string =>
  typeof value === 'string' ? value : '';

/** Turn a raw agent op into a human-readable activity label + icon. */
export function describeOp(op: Pick<AgentOp, 'name' | 'input'>): OpDescription {
  const input = op.input ?? {};
  switch (op.name) {
    case 'add_resource': {
      const service = asString(input.service_id) || 'resource';
      const label = asString(input.label);
      return {
        icon: 'add',
        label: label ? `Added ${service} "${label}"` : `Added ${service}`,
      };
    }
    case 'connect': {
      const kind = asString(input.relationship_kind);
      return {
        icon: 'connect',
        label: kind ? `Connected resources (${kind})` : 'Connected resources',
      };
    }
    case 'configure':
      return { icon: 'configure', label: 'Updated configuration' };
    case 'set_parent':
      return {
        icon: 'parent',
        label: input.parent_id ? 'Nested a resource' : 'Moved to top level',
      };
    case 'remove':
      return { icon: 'remove', label: 'Removed a resource' };
    case 'validate':
      return { icon: 'check', label: 'Validated the architecture' };
    case 'estimate_cost':
      return { icon: 'cost', label: 'Estimated monthly cost' };
    case 'query_graph':
      return { icon: 'info', label: 'Reviewed the canvas' };
    case 'list_services':
      return { icon: 'info', label: 'Browsed the service catalog' };
    case 'get_service':
      return {
        icon: 'info',
        label: `Inspected ${asString(input.service_id) || 'a service'}`,
      };
    default:
      return { icon: 'info', label: op.name };
  }
}
