import { describe, it, expect } from 'vitest';

import '@/services';
import { executeOperation } from './operation-executor';
import { describeOperation } from './operation-label';

import type { GraphState } from './operation-executor';

const empty = (): GraphState => ({ nodes: [], edges: [] });

function vpcWithChildren(): { state: GraphState; vpcId: string } {
  let state = executeOperation(
    'add_resource',
    { service_id: 'vpc' },
    empty(),
  ).state;
  const vpcId = state.nodes[0].id;
  state = executeOperation(
    'add_resource',
    { service_id: 'subnet', parent_id: vpcId },
    state,
  ).state;
  const subnetId = state.nodes[1].id;
  state = executeOperation(
    'add_resource',
    { service_id: 'lambda', parent_id: subnetId, label: 'API' },
    state,
  ).state;
  return { state, vpcId };
}

describe('describeOperation — tense', () => {
  it('describes a pending operation in the imperative and a done operation in the past', () => {
    const described = describeOperation({
      name: 'add_resource',
      input: { service_id: 'lambda', label: 'API' },
    });

    expect(described.pending).toMatch(/^Add /);
    expect(described.past).toMatch(/^Added /);
  });

  it('names the removal target rather than saying "a resource"', () => {
    const { state, vpcId } = vpcWithChildren();
    const label = state.nodes.find((n) => n.id === vpcId)!.data.label;

    const described = describeOperation(
      { name: 'remove', input: { target_id: vpcId } },
      state,
    );

    expect(described.pending).toBe(`Remove ${label}`);
    expect(described.pending).not.toBe('Remove a resource');
  });
});

describe('describeOperation — blast radius', () => {
  it('reports the descendants a removal takes with it', () => {
    const { state, vpcId } = vpcWithChildren();

    const described = describeOperation(
      { name: 'remove', input: { target_id: vpcId } },
      state,
    );

    expect(described.impact.join(' ')).toMatch(/2 nested resources?/);
  });

  it('reports connections a removal severs', () => {
    let state = executeOperation(
      'add_resource',
      { service_id: 'lambda' },
      empty(),
    ).state;
    state = executeOperation(
      'add_resource',
      { service_id: 'sqs' },
      state,
    ).state;
    const [fn, queue] = state.nodes;
    state = executeOperation(
      'connect',
      { source_id: fn.id, target_id: queue.id, relationship_kind: 'invokes' },
      state,
    ).state;

    const described = describeOperation(
      { name: 'remove', input: { target_id: queue.id } },
      state,
    );

    expect(described.impact.join(' ')).toMatch(/1 connection/);
  });

  it('has no impact list for a leaf removal with no edges', () => {
    const state = executeOperation(
      'add_resource',
      { service_id: 'lambda' },
      empty(),
    ).state;

    const described = describeOperation(
      { name: 'remove', input: { target_id: state.nodes[0].id } },
      state,
    );

    expect(described.impact).toEqual([]);
  });

  it('names the node and fields a configure touches', () => {
    const state = executeOperation(
      'add_resource',
      { service_id: 'lambda', label: 'API' },
      empty(),
    ).state;

    const described = describeOperation(
      {
        name: 'configure',
        input: {
          node_id: state.nodes[0].id,
          config_patch: { memoryMb: 1024, timeout: 30 },
        },
      },
      state,
    );

    expect(described.pending).toContain('API');
    expect(described.impact.join(' ')).toContain('memoryMb');
  });

  it('names both ends of a connection', () => {
    let state = executeOperation(
      'add_resource',
      { service_id: 'lambda', label: 'API' },
      empty(),
    ).state;
    state = executeOperation(
      'add_resource',
      { service_id: 'sqs', label: 'Jobs' },
      state,
    ).state;
    const [fn, queue] = state.nodes;

    const described = describeOperation(
      {
        name: 'connect',
        input: {
          source_id: fn.id,
          target_id: queue.id,
          relationship_kind: 'invokes',
        },
      },
      state,
    );

    expect(described.pending).toContain('API');
    expect(described.pending).toContain('Jobs');
  });
});

describe('describeOperation — without a graph', () => {
  it('still produces a usable label when no graph is supplied', () => {
    const described = describeOperation({
      name: 'remove',
      input: { target_id: 'n1' },
    });

    expect(described.pending).toBeTruthy();
    expect(described.impact).toEqual([]);
  });
});
