import { describe, it, expect } from 'vitest';

import type { ClientAnnotation, ClientComment } from '@/api';

import { selectAnchoredThreads } from './inbox';

const comment = (body: string, authorType: 'user' | 'agent'): ClientComment =>
  ({ body, authorType }) as ClientComment;

const makeAnnotation = (over: Partial<ClientAnnotation>): ClientAnnotation =>
  ({
    id: 'a',
    projectId: 'p',
    targetType: 'node',
    targetId: 'n1',
    position: {},
    status: 'open',
    archived: false,
    authorId: 'u1',
    authorName: 'User',
    authorType: 'user',
    origin: '',
    resolvedById: null,
    resolvedByName: '',
    resolvedAt: null,
    comments: [],
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
    ...over,
  }) as ClientAnnotation;

describe('selectAnchoredThreads', () => {
  it('keeps only threads that tag or have been answered by the agent', () => {
    const tagged = makeAnnotation({
      id: 'tagged',
      comments: [comment('@orqestra add a cache', 'user')],
    });
    const answered = makeAnnotation({
      id: 'answered',
      comments: [comment('please look', 'user'), comment('Done.', 'agent')],
    });
    const plain = makeAnnotation({
      id: 'plain',
      comments: [comment('just a note', 'user')],
    });

    const result = selectAnchoredThreads([tagged, answered, plain]);

    expect(result.map((annotation) => annotation.id)).toEqual([
      'tagged',
      'answered',
    ]);
  });

  it('excludes resolved threads', () => {
    const resolved = makeAnnotation({
      id: 'resolved',
      status: 'resolved',
      comments: [comment('@orqestra add a cache', 'user')],
    });

    expect(selectAnchoredThreads([resolved])).toEqual([]);
  });

  it('orders engaged threads by most recently updated first', () => {
    const older = makeAnnotation({
      id: 'older',
      updatedAt: '2026-06-01T00:00:00Z',
      comments: [comment('@orqestra a', 'user')],
    });
    const newer = makeAnnotation({
      id: 'newer',
      updatedAt: '2026-06-10T00:00:00Z',
      comments: [comment('@orqestra b', 'user')],
    });

    const result = selectAnchoredThreads([older, newer]);

    expect(result.map((annotation) => annotation.id)).toEqual([
      'newer',
      'older',
    ]);
  });
});
