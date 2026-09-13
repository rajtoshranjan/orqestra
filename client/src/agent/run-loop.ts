import type { AgentOperation, AgentOperationResult } from '@/api/agent';

import {
  executeOperation,
  type GraphState,
  type OperationOutcome,
} from './operation-executor';
import { resolveOperationRisk } from './risk';

/** Operations that change node positions/topology and so warrant a layout pass. */
export const STRUCTURAL_OPERATIONS = new Set([
  'add_resource',
  'connect',
  'remove',
  'set_parent',
]);

/** What to do when an operation's resolved risk asks for a human decision. */
export type ConfirmPolicy =
  /** Stop and hand the operation back so the caller can ask. */
  | 'pause'
  /** Decline it and keep going — for surfaces with no confirm UI. */
  | 'decline';

export type ProcessOptions = {
  /** Stop and ask (the panel) or decline and continue (anchored threads). */
  confirmPolicy?: ConfirmPolicy;
  /** Called after each applied operation, so a UI can narrate as it goes. */
  onApplied?: (operation: AgentOperation, outcome: OperationOutcome) => void;
  /** Awaited between operations, so the build reads as it assembles. */
  beat?: () => Promise<void>;
  /** Abandon the remaining operations when the user stops the run. */
  signal?: AbortSignal;
  resolveRisk?: typeof resolveOperationRisk;
};

export type ProcessResult = {
  state: GraphState;
  results: AgentOperationResult[];
  /** Set when `confirmPolicy` is 'pause' and an operation needs a decision. */
  pending: { operation: AgentOperation; remaining: AgentOperation[] } | null;
  /** Operations declined outright under the 'decline' policy. */
  declined: AgentOperation[];
  /** True when an applied operation changed topology, so the layout should be re-tidied. */
  structural: boolean;
  /** True when the signal aborted before every operation ran. */
  aborted: boolean;
};

function resultFor(
  operation: AgentOperation,
  outcome: OperationOutcome,
): AgentOperationResult {
  return {
    toolCallId: operation.toolCallId,
    content: outcome.content,
    isError: outcome.isError,
  };
}

/**
 * Apply a turn's operations against the graph, in order.
 *
 * This is the single implementation behind both agent surfaces: the panel
 * passes `confirmPolicy: 'pause'` plus a beat and a narration callback so the
 * canvas visibly assembles; anchored threads, which have no confirm UI, pass
 * `'decline'`. Keeping one loop means the confirm/resume semantics are defined
 * — and tested — in exactly one place.
 */
export async function processOperations(
  operations: AgentOperation[],
  state: GraphState,
  options: ProcessOptions = {},
): Promise<ProcessResult> {
  const {
    confirmPolicy = 'pause',
    onApplied,
    beat,
    signal,
    resolveRisk = resolveOperationRisk,
  } = options;

  let current = state;
  const results: AgentOperationResult[] = [];
  const declined: AgentOperation[] = [];
  let structural = false;

  for (let index = 0; index < operations.length; index += 1) {
    if (signal?.aborted) {
      return {
        state: current,
        results,
        pending: null,
        declined,
        structural,
        aborted: true,
      };
    }

    const operation = operations[index];
    if (
      resolveRisk(operation.risk, operation.name, operation.input) === 'confirm'
    ) {
      if (confirmPolicy === 'pause') {
        return {
          state: current,
          results,
          pending: { operation, remaining: operations.slice(index + 1) },
          declined,
          structural,
          aborted: false,
        };
      }
      const outcome = declineOutcome();
      declined.push(operation);
      results.push(resultFor(operation, outcome));
      continue;
    }

    const outcome = executeOperation(operation.name, operation.input, current);
    current = outcome.state;
    if (outcome.mutated && STRUCTURAL_OPERATIONS.has(operation.name))
      structural = true;
    results.push(resultFor(operation, outcome));
    onApplied?.(operation, outcome);
    if (beat && index < operations.length - 1) await beat();
  }

  return {
    state: current,
    results,
    pending: null,
    declined,
    structural,
    aborted: false,
  };
}

function declineOutcome(): OperationOutcome {
  return {
    state: { nodes: [], edges: [] }, // unused: the caller keeps its own state
    content: 'The user declined this change.',
    isError: false,
    mutated: false,
  };
}

/** Apply (or decline) a single operation the user was asked to confirm. */
export function applyConfirmedOperation(
  operation: AgentOperation,
  state: GraphState,
  approved: boolean,
): { state: GraphState; result: AgentOperationResult; structural: boolean } {
  if (!approved) {
    return {
      state,
      result: {
        toolCallId: operation.toolCallId,
        content: 'The user declined this change.',
        isError: false,
      },
      structural: false,
    };
  }
  const outcome = executeOperation(operation.name, operation.input, state);
  return {
    state: outcome.state,
    result: resultFor(operation, outcome),
    structural: outcome.mutated && STRUCTURAL_OPERATIONS.has(operation.name),
  };
}
