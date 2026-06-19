import { describe, it, expect } from 'vitest';

import type { AgentConversationMessage } from '@/api/agent';

import { messagesToTimeline } from './use-agent-run';

describe('messagesToTimeline', () => {
  it('maps user/assistant text into message items and tool calls into activities', () => {
    const messages: AgentConversationMessage[] = [
      {
        id: 'm1',
        role: 'user',
        content: [{ type: 'text', text: 'Build an API' }],
      },
      {
        id: 'm2',
        role: 'assistant',
        content: [
          { type: 'text', text: 'Adding a Lambda.' },
          {
            type: 'tool_call',
            id: 'tc_1',
            name: 'add_resource',
            input: { service_id: 'lambda' },
          },
        ],
      },
      {
        id: 'm3',
        role: 'tool',
        content: [
          {
            type: 'tool_result',
            tool_call_id: 'tc_1',
            content: 'ok',
            is_error: false,
          },
        ],
      },
    ];

    const timeline = messagesToTimeline(messages);

    expect(timeline).toHaveLength(3);
    expect(timeline[0]).toMatchObject({
      kind: 'message',
      role: 'user',
      text: 'Build an API',
    });
    expect(timeline[1]).toMatchObject({ kind: 'message', role: 'assistant' });
    expect(timeline[2]).toMatchObject({ kind: 'activity', icon: 'add' });
  });

  it('skips empty text blocks and tool_result blocks', () => {
    const messages: AgentConversationMessage[] = [
      { id: 'm1', role: 'assistant', content: [{ type: 'text', text: '   ' }] },
      {
        id: 'm2',
        role: 'tool',
        content: [
          {
            type: 'tool_result',
            tool_call_id: 'x',
            content: 'done',
            is_error: false,
          },
        ],
      },
    ];

    expect(messagesToTimeline(messages)).toEqual([]);
  });
});
