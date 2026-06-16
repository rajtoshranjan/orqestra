import { describe, it, expect } from 'vitest';

import '@/services'; // populate the real registry

import { buildAgentCatalog } from './catalog';

describe('buildAgentCatalog', () => {
  it('projects registered services into catalog entries', () => {
    const catalog = buildAgentCatalog();
    const lambda = catalog.find((entry) => entry.id === 'lambda');

    expect(lambda).toBeDefined();
    expect(lambda?.category).toBe('compute');
    expect(typeof lambda?.summary).toBe('string');
    expect(lambda?.summary?.length).toBeGreaterThan(0);
  });

  it('includes capabilities and relationship metadata', () => {
    const catalog = buildAgentCatalog();
    const lambda = catalog.find((entry) => entry.id === 'lambda');

    expect(lambda?.capabilities?.requires).toContain('execution-role');
    expect(Array.isArray(lambda?.allowedRelationships)).toBe(true);
  });
});
