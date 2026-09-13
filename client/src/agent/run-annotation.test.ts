import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/agent', () => ({
  advanceAgentRun: vi.fn(),
  createAgentConversation: vi.fn(),
  fetchActiveRunForAnnotation: vi.fn(),
  fetchConversationForAnnotation: vi.fn(),
  replyToAnnotation: vi.fn(),
  sendAgentMessage: vi.fn(),
}));

import '@/services';
import {
  advanceAgentRun,
  fetchActiveRunForAnnotation,
  fetchConversationForAnnotation,
  replyToAnnotation,
  sendAgentMessage,
} from '@/api/agent';

import { isAffirmative, runAnnotationAgent } from './run-annotation';

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

const baseOptions = {
  projectId: 'p1',
  annotationId: 'a1',
  message: 'Remove all of it',
  getGraph: () => ({ nodes: [], edges: [] }),
  applyGraph: vi.fn(),
};

describe('isAffirmative', () => {
  it.each(['yes', 'Yes please', 'confirm', 'apply it', 'go ahead', 'approved'])(
    'reads "%s" as approval',
    (text) => {
      expect(isAffirmative(text)).toBe(true);
    },
  );

  it.each(['no', 'not that one', 'actually, skip it', 'what would that do?'])(
    'does not read "%s" as approval',
    (text) => {
      expect(isAffirmative(text)).toBe(false);
    },
  );
});

describe('runAnnotationAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asMock(fetchConversationForAnnotation).mockResolvedValue('conv-1');
    asMock(fetchActiveRunForAnnotation).mockResolvedValue(null);
    asMock(replyToAnnotation).mockResolvedValue(undefined);
  });

  it('surfaces the run error instead of posting a bare "Done."', async () => {
    asMock(sendAgentMessage).mockResolvedValue({
      runId: 'r1',
      status: 'failed',
      assistantText: '',
      ops: [],
      error: 'LLM provider error: 401 UNAUTHENTICATED',
    });

    await expect(runAnnotationAgent(baseOptions)).rejects.toThrow();

    // The body is derived server-side from the failed run, so the client
    // only has to name the run.
    expect(replyToAnnotation).toHaveBeenCalledWith('a1', 'r1');
  });

  it('posts the run id so the server derives the reply from the run', async () => {
    asMock(sendAgentMessage).mockResolvedValue({
      runId: 'r1',
      status: 'completed',
      assistantText: 'Removed lambda-3.',
      ops: [],
    });

    await runAnnotationAgent(baseOptions);

    expect(replyToAnnotation).toHaveBeenCalledWith('a1', 'r1');
    expect(advanceAgentRun).not.toHaveBeenCalled();
  });

  it('pauses on a confirm-risk op and asks in the thread rather than declining', async () => {
    asMock(sendAgentMessage).mockResolvedValue({
      runId: 'r1',
      status: 'awaiting_client',
      assistantText: 'I can remove that.',
      ops: [
        {
          toolCallId: 'tc_1',
          name: 'remove',
          input: { target_id: 'n1' },
          risk: 'confirm' as const,
        },
      ],
    });

    const result = await runAnnotationAgent(baseOptions);

    expect(result.awaitingConfirmation).toBe(true);
    // Nothing was applied and no result was reported: the run stays paused.
    expect(advanceAgentRun).not.toHaveBeenCalled();
  });

  it('applies the paused op when the next comment approves it', async () => {
    asMock(fetchActiveRunForAnnotation).mockResolvedValue({
      id: 'r1',
      status: 'awaiting_client',
      ops: [
        {
          toolCallId: 'tc_1',
          name: 'remove',
          input: { target_id: 'n1' },
          risk: 'confirm' as const,
        },
      ],
    });
    asMock(advanceAgentRun).mockResolvedValue({
      runId: 'r1',
      status: 'completed',
      assistantText: 'Removed it.',
      ops: [],
    });

    await runAnnotationAgent({ ...baseOptions, message: 'yes, go ahead' });

    expect(sendAgentMessage).not.toHaveBeenCalled();
    expect(advanceAgentRun).toHaveBeenCalledTimes(1);
    const results = asMock(advanceAgentRun).mock.calls[0][1];
    expect(results[0].content.toLowerCase()).not.toContain('declined');
  });

  it('declines the paused op when the next comment does not approve it', async () => {
    asMock(fetchActiveRunForAnnotation).mockResolvedValue({
      id: 'r1',
      status: 'awaiting_client',
      ops: [
        {
          toolCallId: 'tc_1',
          name: 'remove',
          input: { target_id: 'n1' },
          risk: 'confirm' as const,
        },
      ],
    });
    asMock(advanceAgentRun).mockResolvedValue({
      runId: 'r1',
      status: 'completed',
      assistantText: 'Understood, left it in place.',
      ops: [],
    });

    await runAnnotationAgent({
      ...baseOptions,
      message: 'no, leave it alone',
    });

    const results = asMock(advanceAgentRun).mock.calls[0][1];
    expect(results[0].content.toLowerCase()).toContain('declined');
  });

  it('refuses to start a second run while one is already working', async () => {
    asMock(fetchActiveRunForAnnotation).mockResolvedValue({
      id: 'r1',
      status: 'running',
      ops: [],
    });

    const result = await runAnnotationAgent(baseOptions);

    expect(result.skipped).toBe(true);
    expect(sendAgentMessage).not.toHaveBeenCalled();
    expect(advanceAgentRun).not.toHaveBeenCalled();
  });
});
