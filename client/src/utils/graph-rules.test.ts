import { describe, it, expect } from 'vitest';

import '@/services';
import type { DiagramNode } from '@/types';
import { createServiceNode } from '@/utils/diagram';

import { checkConnection, checkParent } from './graph-rules';

const node = (
  serviceId: string,
  id: string,
  parentNode?: string,
): DiagramNode => ({
  ...createServiceNode(serviceId, { x: 0, y: 0 }, 1),
  id,
  ...(parentNode ? { parentNode, extent: 'parent' as const } : {}),
});

describe('checkConnection', () => {
  it('allows a relationship the source service declares', () => {
    // lambda declares sqs in allowedRelationships.
    const nodes = [node('lambda', 'a'), node('sqs', 'b')];
    expect(checkConnection('a', 'b', nodes)).toBeNull();
  });

  it('rejects a relationship the source service forbids', () => {
    const nodes = [node('lambda', 'a'), node('lambda', 'b')];
    expect(checkConnection('a', 'b', nodes)).toMatch(/can.t connect/i);
  });

  it('rejects a target outside the source service allow-list', () => {
    // s3 is neither allowed nor forbidden for lambda: the allow-list wins.
    const nodes = [node('lambda', 'a'), node('s3', 'b')];
    expect(checkConnection('a', 'b', nodes)).toBeTruthy();
  });

  it('rejects connecting a node to its own ancestor', () => {
    const nodes = [node('subnet', 'parent'), node('lambda', 'child', 'parent')];
    expect(checkConnection('child', 'parent', nodes)).toMatch(/nesting/i);
  });

  it('rejects a node connecting to itself', () => {
    const nodes = [node('lambda', 'a')];
    expect(checkConnection('a', 'a', nodes)).toBeTruthy();
  });

  it('reports a missing endpoint rather than throwing', () => {
    const nodes = [node('lambda', 'a')];
    expect(checkConnection('a', 'ghost', nodes)).toBeTruthy();
  });
});

describe('checkParent', () => {
  it('allows a parent the child service declares', () => {
    const nodes = [node('subnet', 'p')];
    expect(checkParent('lambda', 'p', nodes)).toBeNull();
  });

  it('rejects a parent the child service forbids', () => {
    const nodes = [node('s3', 'p')];
    expect(checkParent('lambda', 'p', nodes)).toBeTruthy();
  });

  it('rejects a parent outside the child allow-list', () => {
    const nodes = [node('dynamodb', 'p')];
    expect(checkParent('lambda', 'p', nodes)).toBeTruthy();
  });

  it('allows a null parent (top level)', () => {
    expect(checkParent('lambda', null, [])).toBeNull();
  });

  it('reports a missing parent node', () => {
    expect(checkParent('lambda', 'ghost', [])).toBeTruthy();
  });
});
