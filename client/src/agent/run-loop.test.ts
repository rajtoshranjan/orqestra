import { describe, it, expect } from 'vitest';

import '@/services'; // real registry for executeOp

import type { AgentOp } from '@/api/agent';

import { type GraphState } from './op-executor';
import {
  applyConfirmedOp,
  processOps,
  processOpsAutoDecline,
} from './run-loop';

const empty = (): GraphState => ({ nodes: [], edges: [] });

function op(
  name: string,
  input: Record<string, unknown>,
  risk: 'safe' | 'confirm' = 'safe',
): AgentOp {
  return {
    toolCallId: `tc-${name}-${Math.random().toString(16).slice(2)}`,
    name,
    input,
    risk,
  };
}

describe('processOps', () => {
  it('applies safe ops in sequence and returns one result each', () => {
    const ops = [
      op('add_resource', { service_id: 'lambda' }),
      op('add_resource', { service_id: 'dynamodb' }),
    ];

    const result = processOps(ops, empty());

    expect(result.pending).toBeNull();
    expect(result.state.nodes).toHaveLength(2);
    expect(result.results).toHaveLength(2);
    expect(result.results.every((r) => !r.isError)).toBe(true);
  });

  it('stops at a confirm-risk op and returns it plus the remaining ops', () => {
    const ops = [
      op('add_resource', { service_id: 'lambda' }),
      op('remove', { target_id: 'whatever' }, 'confirm'),
      op('add_resource', { service_id: 'dynamodb' }),
    ];

    const result = processOps(ops, empty());

    expect(result.state.nodes).toHaveLength(1); // only the first op applied
    expect(result.results).toHaveLength(1);
    expect(result.pending?.op.name).toBe('remove');
    expect(result.pending?.remaining).toHaveLength(1);
  });
});

describe('applyConfirmedOp', () => {
  it('executes the op when approved', () => {
    const added = processOps(
      [op('add_resource', { service_id: 'lambda' })],
      empty(),
    );
    const node = added.state.nodes[0];

    const { state, result } = applyConfirmedOp(
      op('remove', { target_id: node.id }),
      added.state,
      true,
    );

    expect(state.nodes).toHaveLength(0);
    expect(result.isError).toBe(false);
  });

  it('leaves the graph unchanged when declined', () => {
    const added = processOps(
      [op('add_resource', { service_id: 'lambda' })],
      empty(),
    );

    const { state, result } = applyConfirmedOp(
      op('remove', { target_id: added.state.nodes[0].id }),
      added.state,
      false,
    );

    expect(state.nodes).toHaveLength(1);
    expect(result.content.toLowerCase()).toContain('declined');
  });
});

describe('processOpsAutoDecline', () => {
  it('applies safe ops and declines risky ones without stopping', () => {
    const ops = [
      op('add_resource', { service_id: 'lambda' }),
      op('remove', { target_id: 'x' }, 'confirm'),
      op('add_resource', { service_id: 'dynamodb' }),
    ];

    const result = processOpsAutoDecline(ops, empty());

    expect(result.state.nodes).toHaveLength(2); // both add_resource applied
    expect(result.declined).toHaveLength(1);
    expect(result.declined[0].name).toBe('remove');
    expect(result.results).toHaveLength(3); // a result per op (incl. the decline)
  });
});
