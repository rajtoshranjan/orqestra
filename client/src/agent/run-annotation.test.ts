import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/agent', () => ({
  advanceAgentRun: vi.fn(),
  createAgentConversation: vi.fn(),
  fetchConversationForAnnotation: vi.fn(),
  replyToAnnotation: vi.fn(),
  sendAgentMessage: vi.fn(),
}));

import {
  advanceAgentRun,
  fetchConversationForAnnotation,
  replyToAnnotation,
  sendAgentMessage,
} from '@/api/agent';

import { runAnnotationAgent } from './run-annotation';

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

const baseOptions = {
  projectId: 'p1',
  annotationId: 'a1',
  message: 'Remove all of it',
  getGraph: () => ({ nodes: [], edges: [] }),
  applyGraph: vi.fn(),
};

describe('runAnnotationAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asMock(fetchConversationForAnnotation).mockResolvedValue('conv-1');
    asMock(replyToAnnotation).mockResolvedValue(undefined);
  });

  it('surfaces the run error instead of posting "Done." when the run fails', async () => {
    asMock(sendAgentMessage).mockResolvedValue({
      runId: 'r1',
      status: 'failed',
      assistantText: '',
      ops: [],
      error: 'LLM provider error: 401 UNAUTHENTICATED',
    });

    await expect(runAnnotationAgent(baseOptions)).rejects.toThrow();

    expect(replyToAnnotation).toHaveBeenCalledTimes(1);
    const body = asMock(replyToAnnotation).mock.calls[0][1] as string;
    expect(body).toContain('401 UNAUTHENTICATED');
    expect(body).not.toContain('Done.');
  });

  it('posts the assistant summary when the run completes cleanly', async () => {
    asMock(sendAgentMessage).mockResolvedValue({
      runId: 'r1',
      status: 'completed',
      assistantText: 'Removed lambda-3.',
      ops: [],
    });

    await runAnnotationAgent(baseOptions);

    expect(replyToAnnotation).toHaveBeenCalledWith('a1', 'Removed lambda-3.');
    expect(advanceAgentRun).not.toHaveBeenCalled();
  });
});
