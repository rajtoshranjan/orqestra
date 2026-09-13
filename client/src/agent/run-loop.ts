import type { AgentOp, AgentOpResult } from '@/api/agent';

import { executeOp, type GraphState, type OpOutcome } from './op-executor';
import { resolveOpRisk } from './risk';

/** Ops that change node positions/topology and so warrant a layout pass. */
export const STRUCTURAL_OPS = new Set([
  'add_resource',
  'connect',
  'remove',
  'set_parent',
]);

/** What to do when an op's resolved risk asks for a human decision. */
export type ConfirmPolicy =
  /** Stop and hand the op back so the caller can ask. */
  | 'pause'
  /** Decline it and keep going — for surfaces with no confirm UI. */
  | 'decline';

export type ProcessOptions = {
  /** Stop and ask (the panel) or decline and continue (anchored threads). */
  confirmPolicy?: ConfirmPolicy;
  /** Called after each applied op, so a UI can narrate as it goes. */
  onApplied?: (op: AgentOp, outcome: OpOutcome) => void;
  /** Awaited between ops, so the build reads as it assembles. */
  beat?: () => Promise<void>;
  /** Abandon the remaining ops when the user stops the run. */
  signal?: AbortSignal;
  resolveRisk?: typeof resolveOpRisk;
};

export type ProcessResult = {
  state: GraphState;
  results: AgentOpResult[];
  /** Set when `confirmPolicy` is 'pause' and an op needs a decision. */
  pending: { op: AgentOp; remaining: AgentOp[] } | null;
  /** Ops declined outright under the 'decline' policy. */
  declined: AgentOp[];
  /** True when an applied op changed topology, so the layout should be re-tidied. */
  structural: boolean;
  /** True when the signal aborted before every op ran. */
  aborted: boolean;
};

function resultFor(op: AgentOp, outcome: OpOutcome): AgentOpResult {
  return {
    toolCallId: op.toolCallId,
    content: outcome.content,
    isError: outcome.isError,
  };
}

/**
 * Apply a turn's ops against the graph, in order.
 *
 * This is the single implementation behind both agent surfaces: the panel
 * passes `confirmPolicy: 'pause'` plus a beat and a narration callback so the
 * canvas visibly assembles; anchored threads, which have no confirm UI, pass
 * `'decline'`. Keeping one loop means the confirm/resume semantics are defined
 * — and tested — in exactly one place.
 */
export async function processOps(
  ops: AgentOp[],
  state: GraphState,
  options: ProcessOptions = {},
): Promise<ProcessResult> {
  const {
    confirmPolicy = 'pause',
    onApplied,
    beat,
    signal,
    resolveRisk = resolveOpRisk,
  } = options;

  let current = state;
  const results: AgentOpResult[] = [];
  const declined: AgentOp[] = [];
  let structural = false;

  for (let index = 0; index < ops.length; index += 1) {
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

    const op = ops[index];
    if (resolveRisk(op.risk, op.name, op.input) === 'confirm') {
      if (confirmPolicy === 'pause') {
        return {
          state: current,
          results,
          pending: { op, remaining: ops.slice(index + 1) },
          declined,
          structural,
          aborted: false,
        };
      }
      const outcome = declineOutcome();
      declined.push(op);
      results.push(resultFor(op, outcome));
      continue;
    }

    const outcome = executeOp(op.name, op.input, current);
    current = outcome.state;
    if (outcome.mutated && STRUCTURAL_OPS.has(op.name)) structural = true;
    results.push(resultFor(op, outcome));
    onApplied?.(op, outcome);
    if (beat && index < ops.length - 1) await beat();
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

function declineOutcome(): OpOutcome {
  return {
    state: { nodes: [], edges: [] }, // unused: the caller keeps its own state
    content: 'The user declined this change.',
    isError: false,
    mutated: false,
  };
}

/** Apply (or decline) a single op the user was asked to confirm. */
export function applyConfirmedOp(
  op: AgentOp,
  state: GraphState,
  approved: boolean,
): { state: GraphState; result: AgentOpResult; structural: boolean } {
  if (!approved) {
    return {
      state,
      result: {
        toolCallId: op.toolCallId,
        content: 'The user declined this change.',
        isError: false,
      },
      structural: false,
    };
  }
  const outcome = executeOp(op.name, op.input, state);
  return {
    state: outcome.state,
    result: resultFor(op, outcome),
    structural: outcome.mutated && STRUCTURAL_OPS.has(op.name),
  };
}
