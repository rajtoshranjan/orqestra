import { describe, it, expect, vi } from 'vitest';

vi.mock('@/services', () => ({
  registry: {
    find: (serviceId: string) => {
      const tiers: Record<string, string> = {
        redshift: 'high',
        lambda: 'variable',
      };
      return tiers[serviceId]
        ? { costProfile: { tier: tiers[serviceId] } }
        : null;
    },
  },
}));

import { resolveOpRisk } from './risk';

describe('resolveOpRisk', () => {
  it('keeps server-flagged confirm risk', () => {
    expect(
      resolveOpRisk('confirm', 'add_resource', { service_id: 'lambda' }),
    ).toBe('confirm');
  });

  it('escalates add_resource for high-cost services', () => {
    expect(
      resolveOpRisk('safe', 'add_resource', { service_id: 'redshift' }),
    ).toBe('confirm');
  });

  it('leaves low-cost additions safe', () => {
    expect(
      resolveOpRisk('safe', 'add_resource', { service_id: 'lambda' }),
    ).toBe('safe');
  });

  it('leaves read-only ops safe', () => {
    expect(resolveOpRisk('safe', 'query_graph', {})).toBe('safe');
  });
});
