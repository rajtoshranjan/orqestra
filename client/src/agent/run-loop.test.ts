import { describe, it, expect, vi } from 'vitest';

import '@/services'; // real registry for executeOp

import type { AgentOp } from '@/api/agent';

import { type GraphState } from './op-executor';
import { applyConfirmedOp, processOps } from './run-loop';

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

describe('processOps — pause policy', () => {
  it('applies safe ops in sequence and returns one result each', async () => {
    const ops = [
      op('add_resource', { service_id: 'lambda' }),
      op('add_resource', { service_id: 'dynamodb' }),
    ];

    const result = await processOps(ops, empty());

    expect(result.pending).toBeNull();
    expect(result.state.nodes).toHaveLength(2);
    expect(result.results).toHaveLength(2);
    expect(result.results.every((r) => !r.isError)).toBe(true);
    expect(result.structural).toBe(true);
  });

  it('stops at a confirm-risk op and returns it plus the remaining ops', async () => {
    const ops = [
      op('add_resource', { service_id: 'lambda' }),
      op('remove', { target_id: 'whatever' }, 'confirm'),
      op('add_resource', { service_id: 'dynamodb' }),
    ];

    const result = await processOps(ops, empty());

    expect(result.state.nodes).toHaveLength(1); // only the first op applied
    expect(result.results).toHaveLength(1);
    expect(result.pending?.op.name).toBe('remove');
    expect(result.pending?.remaining).toHaveLength(1);
  });

  it('narrates each applied op through onApplied', async () => {
    const onApplied = vi.fn();

    await processOps([op('add_resource', { service_id: 'lambda' })], empty(), {
      onApplied,
    });

    expect(onApplied).toHaveBeenCalledTimes(1);
    expect(onApplied.mock.calls[0][1].mutated).toBe(true);
  });

  it('waits a beat between ops so the build reads as it assembles', async () => {
    const beat = vi.fn().mockResolvedValue(undefined);

    await processOps(
      [
        op('add_resource', { service_id: 'lambda' }),
        op('add_resource', { service_id: 'dynamodb' }),
      ],
      empty(),
      { beat },
    );

    expect(beat).toHaveBeenCalledTimes(1); // between, not after the last
  });
});

describe('processOps — cancellation', () => {
  it('abandons the remaining ops once the signal aborts', async () => {
    const controller = new AbortController();
    const ops = [
      op('add_resource', { service_id: 'lambda' }),
      op('add_resource', { service_id: 'dynamodb' }),
      op('add_resource', { service_id: 's3' }),
    ];

    const result = await processOps(ops, empty(), {
      signal: controller.signal,
      onApplied: () => controller.abort(),
    });

    expect(result.aborted).toBe(true);
    expect(result.state.nodes).toHaveLength(1);
    expect(result.results).toHaveLength(1);
  });

  it('does nothing at all when already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await processOps(
      [op('add_resource', { service_id: 'lambda' })],
      empty(),
      { signal: controller.signal },
    );

    expect(result.aborted).toBe(true);
    expect(result.state.nodes).toHaveLength(0);
  });
});

describe('processOps — decline policy', () => {
  it('applies safe ops and declines risky ones without stopping', async () => {
    const ops = [
      op('add_resource', { service_id: 'lambda' }),
      op('remove', { target_id: 'x' }, 'confirm'),
      op('add_resource', { service_id: 'dynamodb' }),
    ];

    const result = await processOps(ops, empty(), {
      confirmPolicy: 'decline',
    });

    expect(result.state.nodes).toHaveLength(2); // both add_resource applied
    expect(result.pending).toBeNull();
    expect(result.declined).toHaveLength(1);
    expect(result.declined[0].name).toBe('remove');
    expect(result.results).toHaveLength(3); // a result per op (incl. the decline)
  });
});

describe('applyConfirmedOp', () => {
  it('executes the op when approved', async () => {
    const added = await processOps(
      [op('add_resource', { service_id: 'lambda' })],
      empty(),
    );
    const node = added.state.nodes[0];

    const { state, result, structural } = applyConfirmedOp(
      op('remove', { target_id: node.id }),
      added.state,
      true,
    );

    expect(state.nodes).toHaveLength(0);
    expect(result.isError).toBe(false);
    expect(structural).toBe(true);
  });

  it('leaves the graph unchanged when declined', async () => {
    const added = await processOps(
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
