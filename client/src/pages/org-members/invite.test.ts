import { describe, expect, it } from 'vitest';

import { canSubmitInvite } from './invite';

describe('canSubmitInvite', () => {
  it('is false when the email is invalid', () => {
    expect(canSubmitInvite({ email: 'nope', role: 'regular' })).toBe(false);
  });

  it('is false when the email is empty', () => {
    expect(canSubmitInvite({ email: '   ', role: 'regular' })).toBe(false);
  });

  it('is false when no role is selected', () => {
    expect(canSubmitInvite({ email: 'a@b.com', role: '' })).toBe(false);
  });

  it('is true when the email is valid and a role is selected', () => {
    expect(canSubmitInvite({ email: 'a@b.com', role: 'regular' })).toBe(true);
  });

  it('trims surrounding whitespace before validating', () => {
    expect(canSubmitInvite({ email: '  a@b.com  ', role: 'guest' })).toBe(true);
  });
});
