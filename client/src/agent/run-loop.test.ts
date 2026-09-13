import { describe, it, expect, vi } from 'vitest';

import '@/services'; // real registry for executeOperation

import type { AgentOperation } from '@/api/agent';

import { type GraphState } from './operation-executor';
import { applyConfirmedOperation, processOperations } from './run-loop';

const empty = (): GraphState => ({ nodes: [], edges: [] });

function operation(
  name: string,
  input: Record<string, unknown>,
  risk: 'safe' | 'confirm' = 'safe',
): AgentOperation {
  return {
    toolCallId: `tc-${name}-${Math.random().toString(16).slice(2)}`,
    name,
    input,
    risk,
  };
}

describe('processOperations — pause policy', () => {
  it('applies safe operations in sequence and returns one result each', async () => {
    const operations = [
      operation('add_resource', { service_id: 'lambda' }),
      operation('add_resource', { service_id: 'dynamodb' }),
    ];

    const result = await processOperations(operations, empty());

    expect(result.pending).toBeNull();
    expect(result.state.nodes).toHaveLength(2);
    expect(result.results).toHaveLength(2);
    expect(result.results.every((r) => !r.isError)).toBe(true);
    expect(result.structural).toBe(true);
  });

  it('stops at a confirm-risk operation and returns it plus the remaining operations', async () => {
    const operations = [
      operation('add_resource', { service_id: 'lambda' }),
      operation('remove', { target_id: 'whatever' }, 'confirm'),
      operation('add_resource', { service_id: 'dynamodb' }),
    ];

    const result = await processOperations(operations, empty());

    expect(result.state.nodes).toHaveLength(1); // only the first operation applied
    expect(result.results).toHaveLength(1);
    expect(result.pending?.operation.name).toBe('remove');
    expect(result.pending?.remaining).toHaveLength(1);
  });

  it('narrates each applied operation through onApplied', async () => {
    const onApplied = vi.fn();

    await processOperations(
      [operation('add_resource', { service_id: 'lambda' })],
      empty(),
      {
        onApplied,
      },
    );

    expect(onApplied).toHaveBeenCalledTimes(1);
    expect(onApplied.mock.calls[0][1].mutated).toBe(true);
  });

  it('waits a beat between operations so the build reads as it assembles', async () => {
    const beat = vi.fn().mockResolvedValue(undefined);

    await processOperations(
      [
        operation('add_resource', { service_id: 'lambda' }),
        operation('add_resource', { service_id: 'dynamodb' }),
      ],
      empty(),
      { beat },
    );

    expect(beat).toHaveBeenCalledTimes(1); // between, not after the last
  });
});

describe('processOperations — cancellation', () => {
  it('abandons the remaining operations once the signal aborts', async () => {
    const controller = new AbortController();
    const operations = [
      operation('add_resource', { service_id: 'lambda' }),
      operation('add_resource', { service_id: 'dynamodb' }),
      operation('add_resource', { service_id: 's3' }),
    ];

    const result = await processOperations(operations, empty(), {
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

    const result = await processOperations(
      [operation('add_resource', { service_id: 'lambda' })],
      empty(),
      { signal: controller.signal },
    );

    expect(result.aborted).toBe(true);
    expect(result.state.nodes).toHaveLength(0);
  });
});

describe('processOperations — decline policy', () => {
  it('applies safe operations and declines risky ones without stopping', async () => {
    const operations = [
      operation('add_resource', { service_id: 'lambda' }),
      operation('remove', { target_id: 'x' }, 'confirm'),
      operation('add_resource', { service_id: 'dynamodb' }),
    ];

    const result = await processOperations(operations, empty(), {
      confirmPolicy: 'decline',
    });

    expect(result.state.nodes).toHaveLength(2); // both add_resource applied
    expect(result.pending).toBeNull();
    expect(result.declined).toHaveLength(1);
    expect(result.declined[0].name).toBe('remove');
    expect(result.results).toHaveLength(3); // a result per operation (incl. the decline)
  });
});

describe('applyConfirmedOperation', () => {
  it('executes the operation when approved', async () => {
    const added = await processOperations(
      [operation('add_resource', { service_id: 'lambda' })],
      empty(),
    );
    const node = added.state.nodes[0];

    const { state, result, structural } = applyConfirmedOperation(
      operation('remove', { target_id: node.id }),
      added.state,
      true,
    );

    expect(state.nodes).toHaveLength(0);
    expect(result.isError).toBe(false);
    expect(structural).toBe(true);
  });

  it('leaves the graph unchanged when declined', async () => {
    const added = await processOperations(
      [operation('add_resource', { service_id: 'lambda' })],
      empty(),
    );

    const { state, result } = applyConfirmedOperation(
      operation('remove', { target_id: added.state.nodes[0].id }),
      added.state,
      false,
    );

    expect(state.nodes).toHaveLength(1);
    expect(result.content.toLowerCase()).toContain('declined');
  });
});
