import { describe, it, expect, vi } from 'vitest';

vi.mock('@/services', () => ({
  registry: {
    find: (serviceId: string) => {
      const services: Record<string, Record<string, unknown>> = {
        redshift: { costProfile: { tier: 'high' } },
        lambda: { costProfile: { tier: 'variable' } },
        rds: {
          costProfile: { tier: 'variable' },
          sensitiveConfigKeys: ['instanceClass'],
        },
      };
      return services[serviceId] ?? null;
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

  it('escalates configure when the patch touches a security field', () => {
    expect(
      resolveOpRisk('safe', 'configure', {
        node_id: 'n1',
        service_id: 'lambda',
        config_patch: { publiclyAccessible: true },
      }),
    ).toBe('confirm');
  });

  it('escalates configure when the patch disables encryption', () => {
    expect(
      resolveOpRisk('safe', 'configure', {
        node_id: 'n1',
        config_patch: { encryptionEnabled: false },
      }),
    ).toBe('confirm');
  });

  it('escalates configure on a field the service marks sensitive', () => {
    expect(
      resolveOpRisk('safe', 'configure', {
        node_id: 'n1',
        service_id: 'rds',
        config_patch: { instanceClass: 'db.r6g.16xlarge' },
      }),
    ).toBe('confirm');
  });

  it('leaves an ordinary configure safe', () => {
    expect(
      resolveOpRisk('safe', 'configure', {
        node_id: 'n1',
        service_id: 'lambda',
        config_patch: { memoryMb: 512 },
      }),
    ).toBe('safe');
  });

  it('matches sensitive keys regardless of casing', () => {
    expect(
      resolveOpRisk('safe', 'configure', {
        node_id: 'n1',
        config_patch: { public_access_block: false },
      }),
    ).toBe('confirm');
  });
});
