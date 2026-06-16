import { describe, it, expect } from 'vitest';

import '@/services'; // real registry for createServiceNode

import { executeOp, type GraphState } from './op-executor';

const empty = (): GraphState => ({ nodes: [], edges: [] });

describe('executeOp — mutating ops', () => {
  it('add_resource creates a node from the registry', () => {
    const outcome = executeOp('add_resource', { service_id: 'lambda' }, empty());

    expect(outcome.isError).toBe(false);
    expect(outcome.mutated).toBe(true);
    expect(outcome.state.nodes).toHaveLength(1);
    const node = outcome.state.nodes[0];
    expect(node.data.serviceId).toBe('lambda');
    expect(node.type).toBe('lambdaNode');
    expect(outcome.content).toContain('Added lambda');
  });

  it('add_resource merges supplied config', () => {
    const outcome = executeOp(
      'add_resource',
      { service_id: 'lambda', config: { functionName: 'my-api' }, label: 'My API' },
      empty(),
    );

    const node = outcome.state.nodes[0];
    expect(node.data.config.functionName).toBe('my-api');
    expect(node.data.label).toBe('My API');
  });

  it('add_resource errors on an unknown service', () => {
    const outcome = executeOp('add_resource', { service_id: 'nope' }, empty());

    expect(outcome.isError).toBe(true);
    expect(outcome.mutated).toBe(false);
    expect(outcome.state.nodes).toHaveLength(0);
  });

  it('connect adds a typed edge between existing nodes', () => {
    const added = executeOp('add_resource', { service_id: 'lambda' }, empty());
    const second = executeOp('add_resource', { service_id: 'dynamodb' }, added.state);
    const [a, b] = second.state.nodes;

    const outcome = executeOp(
      'connect',
      { source_id: a.id, target_id: b.id, relationship_kind: 'reads-from' },
      second.state,
    );

    expect(outcome.isError).toBe(false);
    expect(outcome.state.edges).toHaveLength(1);
    expect(outcome.state.edges[0].source).toBe(a.id);
    expect(outcome.state.edges[0].data?.relationshipKind).toBe('reads-from');
  });

  it('connect errors when an endpoint is missing', () => {
    const outcome = executeOp(
      'connect',
      { source_id: 'x', target_id: 'y', relationship_kind: 'invokes' },
      empty(),
    );

    expect(outcome.isError).toBe(true);
    expect(outcome.state.edges).toHaveLength(0);
  });

  it('configure patches a node config', () => {
    const added = executeOp('add_resource', { service_id: 'lambda' }, empty());
    const node = added.state.nodes[0];

    const outcome = executeOp(
      'configure',
      { node_id: node.id, config_patch: { memorySize: 512 } },
      added.state,
    );

    expect(outcome.isError).toBe(false);
    expect(outcome.state.nodes[0].data.config.memorySize).toBe(512);
  });

  it('remove deletes a node and its connected edges', () => {
    const added = executeOp('add_resource', { service_id: 'lambda' }, empty());
    const second = executeOp('add_resource', { service_id: 'dynamodb' }, added.state);
    const [a, b] = second.state.nodes;
    const connected = executeOp(
      'connect',
      { source_id: a.id, target_id: b.id, relationship_kind: 'reads-from' },
      second.state,
    );

    const outcome = executeOp('remove', { target_id: a.id }, connected.state);

    expect(outcome.isError).toBe(false);
    expect(outcome.state.nodes.map((n) => n.id)).toEqual([b.id]);
    expect(outcome.state.edges).toHaveLength(0);
  });

  it('returns an error for an unknown op', () => {
    const outcome = executeOp('frobnicate', {}, empty());

    expect(outcome.isError).toBe(true);
    expect(outcome.mutated).toBe(false);
  });
});
