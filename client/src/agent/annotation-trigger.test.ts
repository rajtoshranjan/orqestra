import { describe, it, expect } from 'vitest';

import { bodyMentionsAgent, buildAnnotationAgentMessage } from './annotation-trigger';

describe('bodyMentionsAgent', () => {
  it('detects @orqestra at the start or after whitespace', () => {
    expect(bodyMentionsAgent('@orqestra add a cache')).toBe(true);
    expect(bodyMentionsAgent('hey @Orqestra please help')).toBe(true);
  });

  it('ignores plain text and email-like strings', () => {
    expect(bodyMentionsAgent('just a normal comment')).toBe(false);
    expect(bodyMentionsAgent('email me@orqestra.com')).toBe(false);
  });
});

describe('buildAnnotationAgentMessage', () => {
  it('includes the node label and the user message', () => {
    const message = buildAnnotationAgentMessage({
      targetType: 'node',
      targetId: 'n1',
      label: 'API Lambda',
      body: '@orqestra give this more memory',
    });

    expect(message).toContain('API Lambda');
    expect(message).toContain('n1');
    expect(message).toContain('@orqestra give this more memory');
  });

  it('handles canvas targets', () => {
    const message = buildAnnotationAgentMessage({
      targetType: 'canvas',
      body: '@orqestra add a staging environment',
    });

    expect(message.toLowerCase()).toContain('canvas');
  });
});
