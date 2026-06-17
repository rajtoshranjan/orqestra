import { describe, it, expect } from 'vitest';

import { describeOp } from './op-label';

describe('describeOp', () => {
  it('describes add_resource with the service id', () => {
    expect(describeOp({ name: 'add_resource', input: { service_id: 'lambda' } })).toEqual({
      icon: 'add',
      label: 'Added lambda',
    });
  });

  it('includes an explicit label when provided', () => {
    expect(
      describeOp({ name: 'add_resource', input: { service_id: 'lambda', label: 'API' } }).label,
    ).toBe('Added lambda "API"');
  });

  it('maps remove and validate to their icons', () => {
    expect(describeOp({ name: 'remove', input: {} }).icon).toBe('remove');
    expect(describeOp({ name: 'validate', input: {} }).icon).toBe('check');
  });

  it('falls back to the raw op name', () => {
    expect(describeOp({ name: 'frobnicate', input: {} })).toEqual({
      icon: 'info',
      label: 'frobnicate',
    });
  });
});
