import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./client', () => ({ api: { post: vi.fn(), get: vi.fn() } }));

import {
  advanceAgentRun,
  cancelAgentRun,
  createAgentConversation,
  fetchConversationForAnnotation,
  fetchLatestConversation,
  replyToAnnotation,
  sendAgentMessage,
} from './agent';
import { api } from './client';

const post = api.post as unknown as ReturnType<typeof vi.fn>;
const get = api.get as unknown as ReturnType<typeof vi.fn>;

describe('agent api', () => {
  beforeEach(() => {
    post.mockReset();
    get.mockReset();
  });

  it('fetches the latest conversation (paginated) with its messages', async () => {
    get.mockResolvedValueOnce({
      data: {
        data: {
          results: [
            { id: 'old', created_at: '2026-06-01T00:00:00Z' },
            { id: 'new', created_at: '2026-06-10T00:00:00Z' },
          ],
        },
      },
    });
    get.mockResolvedValueOnce({
      data: {
        data: {
          id: 'new',
          messages: [{ id: 'm1', role: 'user', content: [] }],
        },
      },
    });

    const result = await fetchLatestConversation('p1');

    expect(get).toHaveBeenNthCalledWith(
      1,
      '/agent/conversations/?project=p1&standalone=true',
    );
    expect(get).toHaveBeenNthCalledWith(2, '/agent/conversations/new/');
    expect(result).toEqual({
      id: 'new',
      messages: [{ id: 'm1', role: 'user', content: [] }],
      activeRun: null,
    });
  });

  it('returns null when the project has no conversation', async () => {
    get.mockResolvedValueOnce({ data: { data: { results: [] } } });

    expect(await fetchLatestConversation('p1')).toBeNull();
  });

  it('fetches the latest conversation id linked to an annotation', async () => {
    get.mockResolvedValueOnce({
      data: {
        data: {
          results: [
            { id: 'old', created_at: '2026-06-01T00:00:00Z' },
            { id: 'new', created_at: '2026-06-10T00:00:00Z' },
          ],
        },
      },
    });

    const result = await fetchConversationForAnnotation('a1');

    expect(get).toHaveBeenCalledWith('/agent/conversations/?annotation=a1');
    expect(result).toBe('new');
  });

  it('returns null when no conversation is linked to the annotation', async () => {
    get.mockResolvedValueOnce({ data: { data: { results: [] } } });

    expect(await fetchConversationForAnnotation('a1')).toBeNull();
  });

  it('creates an annotation-linked conversation when annotationId is given', async () => {
    post.mockResolvedValue({
      data: { data: { id: 'c2', project: 'p1', status: 'active' } },
    });

    await createAgentConversation({
      projectId: 'p1',
      catalog: [],
      annotationId: 'a1',
    });

    expect(post).toHaveBeenCalledWith('/agent/conversations/', {
      project: 'p1',
      catalog: [],
      annotation: 'a1',
    });
  });

  it('creates a conversation with project + catalog', async () => {
    post.mockResolvedValue({
      data: { data: { id: 'c1', project: 'p1', status: 'active' } },
    });

    const result = await createAgentConversation({
      projectId: 'p1',
      catalog: [{ id: 'lambda', name: 'AWS Lambda', category: 'compute' }],
    });

    expect(post).toHaveBeenCalledWith('/agent/conversations/', {
      project: 'p1',
      catalog: [{ id: 'lambda', name: 'AWS Lambda', category: 'compute' }],
    });
    expect(result).toEqual({ id: 'c1', projectId: 'p1', status: 'active' });
  });

  it('maps the advance payload from send', async () => {
    post.mockResolvedValue({
      data: {
        data: {
          run_id: 'r1',
          status: 'awaiting_client',
          assistant_text: 'Adding a Lambda.',
          operations: [
            {
              tool_call_id: 'tc_1',
              name: 'add_resource',
              input: { service_id: 'lambda' },
              risk: 'safe',
            },
          ],
        },
      },
    });

    const result = await sendAgentMessage('c1', 'build api');

    expect(post).toHaveBeenCalledWith(
      '/agent/conversations/c1/send/',
      { message: 'build api' },
      { signal: undefined },
    );
    expect(result.runId).toBe('r1');
    expect(result.assistantText).toBe('Adding a Lambda.');
    expect(result.operations[0]).toEqual({
      toolCallId: 'tc_1',
      name: 'add_resource',
      input: { service_id: 'lambda' },
      risk: 'safe',
    });
  });

  it('sends operation results in snake_case to advance', async () => {
    post.mockResolvedValue({
      data: {
        data: {
          run_id: 'r1',
          status: 'completed',
          assistant_text: 'Done.',
          operations: [],
        },
      },
    });

    const result = await advanceAgentRun('r1', [
      { toolCallId: 'tc_1', content: 'node added', isError: false },
    ]);

    expect(post).toHaveBeenCalledWith(
      '/agent/runs/r1/advance/',
      {
        operation_results: [
          { tool_call_id: 'tc_1', content: 'node added', is_error: false },
        ],
      },
      { signal: undefined },
    );
    expect(result.status).toBe('completed');
    expect(result.operations).toEqual([]);
  });

  it('includes the live graph snapshot when provided to send', async () => {
    post.mockResolvedValue({
      data: {
        data: {
          run_id: 'r1',
          status: 'completed',
          assistant_text: '',
          operations: [],
        },
      },
    });

    await sendAgentMessage('c1', 'update the bucket', {
      nodes: [{ id: 'n1', data: { service_id: 's3' } }],
      edges: [],
    });

    expect(post).toHaveBeenCalledWith(
      '/agent/conversations/c1/send/',
      {
        message: 'update the bucket',
        graph: { nodes: [{ id: 'n1', data: { service_id: 's3' } }], edges: [] },
      },
      { signal: undefined },
    );
  });

  it('includes the live graph snapshot when provided to advance', async () => {
    post.mockResolvedValue({
      data: {
        data: {
          run_id: 'r1',
          status: 'completed',
          assistant_text: '',
          operations: [],
        },
      },
    });

    await advanceAgentRun(
      'r1',
      [{ toolCallId: 'tc_1', content: 'ok', isError: false }],
      { nodes: [], edges: [] },
    );

    expect(post).toHaveBeenCalledWith(
      '/agent/runs/r1/advance/',
      {
        operation_results: [
          { tool_call_id: 'tc_1', content: 'ok', is_error: false },
        ],
        graph: { nodes: [], edges: [] },
      },
      { signal: undefined },
    );
  });

  it('posts an agent reply keyed to the run that produced it', async () => {
    post.mockResolvedValue({ data: { data: {} } });

    await replyToAnnotation('a1', 'run-1');

    // The body is derived server-side from the run: a caller must not be able
    // to publish arbitrary text under the agent's name.
    expect(post).toHaveBeenCalledWith('/agent/annotations/a1/reply/', {
      run: 'run-1',
    });
  });

  it('cancels a run', async () => {
    post.mockResolvedValue({ data: { data: {} } });

    await cancelAgentRun('r1');

    expect(post).toHaveBeenCalledWith('/agent/runs/r1/cancel/', {});
  });

  it('surfaces a run left in flight by a previous session', async () => {
    get.mockResolvedValueOnce({
      data: {
        data: { results: [{ id: 'c1', created_at: '2026-06-10T00:00:00Z' }] },
      },
    });
    get.mockResolvedValueOnce({
      data: {
        data: {
          id: 'c1',
          messages: [],
          active_run: {
            id: 'r9',
            status: 'awaiting_client',
            turn_count: 3,
            input_tokens: 10,
            output_tokens: 5,
          },
        },
      },
    });

    const result = await fetchLatestConversation('p1');

    expect(result?.activeRun?.id).toBe('r9');
    expect(result?.activeRun?.turnCount).toBe(3);
  });
});
