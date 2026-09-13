import { describe, it, expect } from 'vitest';

import '@/services'; // real registry for createServiceNode

import { executeOperation, type GraphState } from './operation-executor';

const empty = (): GraphState => ({ nodes: [], edges: [] });

describe('executeOperation — mutating operations', () => {
  it('add_resource creates a node from the registry', () => {
    const outcome = executeOperation(
      'add_resource',
      { service_id: 'lambda' },
      empty(),
    );

    expect(outcome.isError).toBe(false);
    expect(outcome.mutated).toBe(true);
    expect(outcome.state.nodes).toHaveLength(1);
    const node = outcome.state.nodes[0];
    expect(node.data.serviceId).toBe('lambda');
    expect(node.type).toBe('lambdaNode');
    expect(outcome.content).toContain('Added lambda');
  });

  it('add_resource merges supplied config', () => {
    const outcome = executeOperation(
      'add_resource',
      {
        service_id: 'lambda',
        config: { functionName: 'my-api' },
        label: 'My API',
      },
      empty(),
    );

    const node = outcome.state.nodes[0];
    expect(node.data.config.functionName).toBe('my-api');
    expect(node.data.label).toBe('My API');
  });

  it('add_resource errors on an unknown service', () => {
    const outcome = executeOperation(
      'add_resource',
      { service_id: 'nope' },
      empty(),
    );

    expect(outcome.isError).toBe(true);
    expect(outcome.mutated).toBe(false);
    expect(outcome.state.nodes).toHaveLength(0);
  });

  it('connect adds a typed edge between existing nodes', () => {
    const added = executeOperation(
      'add_resource',
      { service_id: 'lambda' },
      empty(),
    );
    const second = executeOperation(
      'add_resource',
      { service_id: 'dynamodb' },
      added.state,
    );
    const [a, b] = second.state.nodes;

    const outcome = executeOperation(
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
    const outcome = executeOperation(
      'connect',
      { source_id: 'x', target_id: 'y', relationship_kind: 'invokes' },
      empty(),
    );

    expect(outcome.isError).toBe(true);
    expect(outcome.state.edges).toHaveLength(0);
  });

  it('configure patches a node config', () => {
    const added = executeOperation(
      'add_resource',
      { service_id: 'lambda' },
      empty(),
    );
    const node = added.state.nodes[0];

    const outcome = executeOperation(
      'configure',
      { node_id: node.id, config_patch: { memorySize: 512 } },
      added.state,
    );

    expect(outcome.isError).toBe(false);
    expect(outcome.state.nodes[0].data.config.memorySize).toBe(512);
  });

  it('remove deletes a node and its connected edges', () => {
    const added = executeOperation(
      'add_resource',
      { service_id: 'lambda' },
      empty(),
    );
    const second = executeOperation(
      'add_resource',
      { service_id: 'dynamodb' },
      added.state,
    );
    const [a, b] = second.state.nodes;
    const connected = executeOperation(
      'connect',
      { source_id: a.id, target_id: b.id, relationship_kind: 'reads-from' },
      second.state,
    );

    const outcome = executeOperation(
      'remove',
      { target_id: a.id },
      connected.state,
    );

    expect(outcome.isError).toBe(false);
    expect(outcome.state.nodes.map((n) => n.id)).toEqual([b.id]);
    expect(outcome.state.edges).toHaveLength(0);
  });

  it('returns an error for an unknown operation', () => {
    const outcome = executeOperation('frobnicate', {}, empty());

    expect(outcome.isError).toBe(true);
    expect(outcome.mutated).toBe(false);
  });
});

describe('executeOperation — read-only operations', () => {
  it('query_graph returns a JSON summary without mutating', () => {
    const added = executeOperation(
      'add_resource',
      { service_id: 'lambda' },
      empty(),
    );

    const outcome = executeOperation('query_graph', {}, added.state);

    expect(outcome.mutated).toBe(false);
    expect(outcome.state).toBe(added.state);
    const parsed = JSON.parse(outcome.content);
    expect(parsed.nodes[0].serviceId).toBe('lambda');
  });

  it('validate reports per-node errors', () => {
    // A lambda with no IAM role violates its declared validation rules.
    const added = executeOperation(
      'add_resource',
      { service_id: 'lambda' },
      empty(),
    );

    const outcome = executeOperation('validate', {}, added.state);

    expect(outcome.isError).toBe(false);
    expect(outcome.content.toLowerCase()).toContain('validation');
  });

  it('estimate_cost returns a dollar figure', () => {
    const added = executeOperation(
      'add_resource',
      { service_id: 'lambda' },
      empty(),
    );

    const outcome = executeOperation('estimate_cost', {}, added.state);

    expect(outcome.content).toContain('$');
  });

  it('list_services lists catalog ids', () => {
    const outcome = executeOperation('list_services', {}, empty());

    expect(outcome.content).toContain('lambda');
  });

  it('get_service returns details for a known service', () => {
    const outcome = executeOperation(
      'get_service',
      { service_id: 'lambda' },
      empty(),
    );

    const parsed = JSON.parse(outcome.content);
    expect(parsed.id).toBe('lambda');
  });

  it('get_service errors on an unknown id', () => {
    const outcome = executeOperation(
      'get_service',
      { service_id: 'nope' },
      empty(),
    );

    expect(outcome.isError).toBe(true);
  });
});

describe('executeOperation — structural rules', () => {
  it('connect refuses a relationship the source service forbids', () => {
    let state = executeOperation(
      'add_resource',
      { service_id: 'lambda' },
      empty(),
    ).state;
    state = executeOperation(
      'add_resource',
      { service_id: 'lambda' },
      state,
    ).state;
    const [a, b] = state.nodes;

    const outcome = executeOperation(
      'connect',
      { source_id: a.id, target_id: b.id, relationship_kind: 'invokes' },
      state,
    );

    expect(outcome.isError).toBe(true);
    expect(outcome.mutated).toBe(false);
    expect(outcome.state.edges).toHaveLength(0);
  });

  it('connect reports validation state like the other mutating operations', () => {
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
    const [a, b] = state.nodes;

    const outcome = executeOperation(
      'connect',
      { source_id: a.id, target_id: b.id, relationship_kind: 'invokes' },
      state,
    );

    expect(outcome.isError).toBe(false);
    expect(outcome.content).toContain('Validation');
  });

  it('connect refuses a duplicate edge', () => {
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
    const [a, b] = state.nodes;
    state = executeOperation(
      'connect',
      { source_id: a.id, target_id: b.id, relationship_kind: 'invokes' },
      state,
    ).state;

    const outcome = executeOperation(
      'connect',
      { source_id: a.id, target_id: b.id, relationship_kind: 'invokes' },
      state,
    );

    expect(outcome.isError).toBe(true);
    expect(outcome.state.edges).toHaveLength(1);
  });

  it('add_resource refuses a parent the child service forbids', () => {
    const state = executeOperation(
      'add_resource',
      { service_id: 's3' },
      empty(),
    ).state;

    const outcome = executeOperation(
      'add_resource',
      { service_id: 'lambda', parent_id: state.nodes[0].id },
      state,
    );

    expect(outcome.isError).toBe(true);
    expect(outcome.state.nodes).toHaveLength(1);
  });

  it('add_resource fans children out instead of stacking them', () => {
    let state = executeOperation(
      'add_resource',
      { service_id: 'subnet' },
      empty(),
    ).state;
    const parentId = state.nodes[0].id;

    for (let i = 0; i < 3; i += 1) {
      state = executeOperation(
        'add_resource',
        { service_id: 'lambda', parent_id: parentId },
        state,
      ).state;
    }

    const children = state.nodes.filter((n) => n.parentNode === parentId);
    expect(children).toHaveLength(3);
    const positions = new Set(
      children.map((n) => `${n.position.x},${n.position.y}`),
    );
    expect(positions.size).toBe(3);
  });

  it('set_parent refuses an illegal parent', () => {
    let state = executeOperation(
      'add_resource',
      { service_id: 's3' },
      empty(),
    ).state;
    state = executeOperation(
      'add_resource',
      { service_id: 'lambda' },
      state,
    ).state;
    const [bucket, fn] = state.nodes;

    const outcome = executeOperation(
      'set_parent',
      { node_id: fn.id, parent_id: bucket.id },
      state,
    );

    expect(outcome.isError).toBe(true);
    expect(
      outcome.state.nodes.find((n) => n.id === fn.id)?.parentNode,
    ).toBeUndefined();
  });

  it('remove revalidates the nodes that are left', () => {
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

    const outcome = executeOperation('remove', { target_id: queue.id }, state);

    // The survivor must carry freshly computed validation, not its stale copy.
    const survivor = outcome.state.nodes.find((n) => n.id === fn.id)!;
    expect(survivor.data.validationErrors).toBeDefined();
    expect(outcome.state.edges).toHaveLength(0);
  });

  it('validate writes its findings onto the canvas nodes', () => {
    const state = executeOperation(
      'add_resource',
      { service_id: 'lambda' },
      empty(),
    ).state;

    const outcome = executeOperation('validate', {}, state);

    expect(outcome.mutated).toBe(true);
    expect(outcome.state.nodes[0].data.validationErrors).toBeDefined();
  });

  it('list_services always returns non-empty content', () => {
    const outcome = executeOperation(
      'list_services',
      { category: 'no-such-category' },
      empty(),
    );

    expect(outcome.content.trim().length).toBeGreaterThan(0);
    expect(outcome.isError).toBe(false);
  });
});
