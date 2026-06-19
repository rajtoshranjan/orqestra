import type { AgentOp, AgentOpResult } from '@/api/agent';

import { executeOp, type GraphState } from './op-executor';
import { resolveOpRisk } from './risk';

export type ProcessResult = {
  state: GraphState;
  results: AgentOpResult[];
  pending: { op: AgentOp; remaining: AgentOp[] } | null;
};

/**
 * Apply agent ops sequentially against the graph. Stops at the first op whose
 * resolved risk requires confirmation, returning that op plus the ops still to
 * run so the caller can resume after the user decides.
 */
export function processOps(
  ops: AgentOp[],
  state: GraphState,
  resolveRisk: typeof resolveOpRisk = resolveOpRisk,
): ProcessResult {
  let current = state;
  const results: AgentOpResult[] = [];

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    if (resolveRisk(op.risk, op.name, op.input) === 'confirm') {
      return {
        state: current,
        results,
        pending: { op, remaining: ops.slice(i + 1) },
      };
    }
    const outcome = executeOp(op.name, op.input, current);
    current = outcome.state;
    results.push({
      toolCallId: op.toolCallId,
      content: outcome.content,
      isError: outcome.isError,
    });
  }

  return { state: current, results, pending: null };
}

/** Apply (or decline) a single op the user was asked to confirm. */
export function applyConfirmedOp(
  op: AgentOp,
  state: GraphState,
  approved: boolean,
): { state: GraphState; result: AgentOpResult } {
  if (!approved) {
    return {
      state,
      result: {
        toolCallId: op.toolCallId,
        content: 'The user declined this change.',
        isError: false,
      },
    };
  }
  const outcome = executeOp(op.name, op.input, state);
  return {
    state: outcome.state,
    result: {
      toolCallId: op.toolCallId,
      content: outcome.content,
      isError: outcome.isError,
    },
  };
}

export type AutoProcessResult = {
  state: GraphState;
  results: AgentOpResult[];
  declined: AgentOp[];
  /** True when an applied op changed the graph's topology (added/removed/wired/
   * re-parented a node) — i.e. the layout should be re-tidied. Pure `configure`
   * edits don't move anything, so they don't set this. */
  structural: boolean;
};

/** Ops that change node positions/topology and so warrant a layout pass. */
export const STRUCTURAL_OPS = new Set([
  'add_resource',
  'connect',
  'remove',
  'set_parent',
]);

/**
 * Like processOps but never stops: safe ops apply, confirm-risk ops are
 * auto-declined (graph unchanged for them) and recorded. Used by the
 * annotation-tagging flow, which has no in-thread confirm UI.
 */
export function processOpsAutoDecline(
  ops: AgentOp[],
  state: GraphState,
  resolveRisk: typeof resolveOpRisk = resolveOpRisk,
): AutoProcessResult {
  let current = state;
  const results: AgentOpResult[] = [];
  const declined: AgentOp[] = [];
  let structural = false;

  for (const op of ops) {
    if (resolveRisk(op.risk, op.name, op.input) === 'confirm') {
      const { result } = applyConfirmedOp(op, current, false);
      results.push(result);
      declined.push(op);
      continue;
    }
    const outcome = executeOp(op.name, op.input, current);
    current = outcome.state;
    if (outcome.mutated && STRUCTURAL_OPS.has(op.name)) structural = true;
    results.push({
      toolCallId: op.toolCallId,
      content: outcome.content,
      isError: outcome.isError,
    });
  }

  return { state: current, results, declined, structural };
}
