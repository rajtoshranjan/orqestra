import type { ClientAnnotation } from '@/api';

import { threadEngagesAgent } from './annotation-trigger';

/**
 * Canvas-anchored threads the agent is engaged in, newest first. Resolved
 * threads are excluded — `threadEngagesAgent` already returns false for them.
 * Backs the agent panel's "Threads" tab.
 */
export function selectAnchoredThreads(
  annotations: ClientAnnotation[],
): ClientAnnotation[] {
  return annotations
    .filter((annotation) => threadEngagesAgent(annotation))
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
}
