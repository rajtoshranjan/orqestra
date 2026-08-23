import { describe, it, expect } from 'vitest';

import {
  bodyMentionsAgent,
  buildAnnotationAgentMessage,
  shouldTriggerAgent,
  threadEngagesAgent,
} from './annotation-trigger';

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

describe('threadEngagesAgent / shouldTriggerAgent', () => {
  it('stays engaged in an open thread once the agent has replied', () => {
    const thread = {
      status: 'open',
      comments: [
        { body: '@orqestra add a cache', authorType: 'user' },
        { body: 'Done — added Redis.', authorType: 'agent' },
      ],
    };
    expect(threadEngagesAgent(thread)).toBe(true);
    // A follow-up that does NOT re-tag still triggers the agent.
    expect(shouldTriggerAgent('actually make it bigger', thread)).toBe(true);
  });

  it('stops once the thread is resolved', () => {
    const thread = {
      status: 'resolved',
      comments: [{ body: '@orqestra add a cache', authorType: 'user' }],
    };
    expect(threadEngagesAgent(thread)).toBe(false);
    // Re-tagging a resolved thread still works (explicit opt-in).
    expect(shouldTriggerAgent('@orqestra reopen this', thread)).toBe(true);
    expect(shouldTriggerAgent('never mind', thread)).toBe(false);
  });

  it('does not engage a thread the agent was never tagged in', () => {
    const thread = {
      status: 'open',
      comments: [{ body: 'looks good to me', authorType: 'user' }],
    };
    expect(shouldTriggerAgent('and one more thing', thread)).toBe(false);
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
