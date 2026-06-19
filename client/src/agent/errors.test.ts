import { describe, it, expect } from 'vitest';

import { describeAgentError } from './errors';

describe('describeAgentError', () => {
  it('prefers the server meta.message', () => {
    const error = {
      response: { data: { meta: { message: 'Project is read-only.' } } },
    };
    expect(describeAgentError(error)).toBe('Project is read-only.');
  });

  it('falls back to DRF detail', () => {
    const error = { response: { data: { detail: 'Not found.' } } };
    expect(describeAgentError(error)).toBe('Not found.');
  });

  it('extracts the first field error', () => {
    const error = {
      response: { data: { errors: { message: ['This field is required.'] } } },
    };
    expect(describeAgentError(error)).toBe('This field is required.');
  });

  it('uses the error message when there is no response body', () => {
    expect(describeAgentError(new Error('Network Error'))).toBe(
      'Network Error',
    );
  });

  it('returns a friendly default for opaque errors', () => {
    expect(describeAgentError({})).toBe(
      'Something went wrong. Please try again.',
    );
  });

  it('passes through plain strings', () => {
    expect(describeAgentError('boom')).toBe('boom');
  });
});
