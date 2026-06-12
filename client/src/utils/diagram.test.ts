import { describe, it, expect, vi } from 'vitest';

vi.mock('history', () => {
  return {
    createBrowserHistory: () => ({
      listen: () => {},
      push: () => {},
      replace: () => {},
      location: { pathname: '/' },
    }),
  };
});

import type { DiagramNode } from '@/types';

import { adjustParentSizes, findBestParentForPosition } from './diagram';

describe('diagram parenting and layout utility tests', () => {
  it('should adjust parent container dimensions to fit child nodes', () => {
    const nodes: DiagramNode[] = [
      {
        id: 'vpc-1',
        type: 'vpcNode',
        position: { x: 100, y: 100 },
        style: { width: 240, height: 140 },
        data: {
          serviceId: 'vpc',
          label: 'VPC',
          config: {},
          validationErrors: {},
        },
      },
      {
        id: 'lambda-1',
        type: 'lambdaNode',
        parentNode: 'vpc-1',
        position: { x: 100, y: 120 }, // position relative to parent
        data: {
          serviceId: 'lambda',
          label: 'Lambda',
          config: { parentId: 'vpc-1' },
          validationErrors: {},
        },
      },
    ];

    const adjusted = adjustParentSizes(nodes);
    const vpc = adjusted.find((n) => n.id === 'vpc-1')!;

    // Lambda position.x (100) + width (200) + PADDING (24) = 324
    // Lambda position.y (120) + height (100) + PADDING (24) = 244
    expect(vpc.style?.width).toBe(324);
    expect(vpc.style?.height).toBe(244);
  });

  it('should find the correct parent container for a given coordinate', () => {
    const nodes: DiagramNode[] = [
      {
        id: 'vpc-1',
        type: 'vpcNode',
        position: { x: 100, y: 100 },
        style: { width: 500, height: 400 },
        data: {
          serviceId: 'vpc',
          label: 'VPC',
          config: {},
          validationErrors: {},
        },
      },
      {
        id: 'subnet-1',
        type: 'subnetNode',
        parentNode: 'vpc-1',
        position: { x: 50, y: 50 }, // absolute is x:150, y:150
        style: { width: 300, height: 250 },
        data: {
          serviceId: 'subnet',
          label: 'Subnet',
          config: { parentId: 'vpc-1' },
          validationErrors: {},
        },
      },
    ];

    // Node coordinate inside subnet-1: absolute position of center would be e.g. x:200, y:200
    // findBestParentForPosition takes absolute coordinates.
    // Let's drop at absolute coordinates x: 220, y: 220
    const parent = findBestParentForPosition(
      { x: 120, y: 120 },
      'lambda',
      nodes,
    );
    expect(parent).not.toBeNull();
    expect(parent.id).toBe('subnet-1');
  });
});
