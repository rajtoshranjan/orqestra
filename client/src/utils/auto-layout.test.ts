import { describe, it, expect } from 'vitest';
import { autoLayoutDiagram } from './auto-layout';
import type { DiagramNode } from '@/types';

describe('auto-layout engine tests', () => {
  it('should layout parent and nested nodes correctly', () => {
    const nodes: DiagramNode[] = [
      {
        id: 'vpc-1',
        type: 'vpc',
        data: {
          serviceId: 'vpc',
          label: 'My VPC',
          config: {},
          validationErrors: {},
        },
        position: { x: 0, y: 0 },
      },
      {
        id: 'subnet-1',
        type: 'subnet',
        parentNode: 'vpc-1',
        data: {
          serviceId: 'subnet',
          label: 'Subnet 1',
          config: { parentId: 'vpc-1' },
          validationErrors: {},
        },
        position: { x: 0, y: 0 },
      },
      {
        id: 'subnet-2',
        type: 'subnet',
        parentNode: 'vpc-1',
        data: {
          serviceId: 'subnet',
          label: 'Subnet 2',
          config: { parentId: 'vpc-1' },
          validationErrors: {},
        },
        position: { x: 0, y: 0 },
      },
    ];

    const result = autoLayoutDiagram(nodes, []);
    const vpc = result.find((n) => n.id === 'vpc-1')!;
    const sub1 = result.find((n) => n.id === 'subnet-1')!;
    const sub2 = result.find((n) => n.id === 'subnet-2')!;

    // Check containers have computed dimensions
    expect(vpc.style?.width).toBeGreaterThan(300);
    expect(vpc.style?.height).toBeGreaterThan(100);

    // Check subnets are placed side-by-side inside the VPC
    expect(sub2.position.x).toBeGreaterThan(sub1.position.x);
    expect(sub1.position.y).toBe(sub2.position.y);
  });

  it('should position API Gateway as ingress on the left', () => {
    const nodes: DiagramNode[] = [
      {
        id: 'apigw-1',
        type: 'api-gateway',
        data: {
          serviceId: 'api-gateway',
          label: 'My API',
          config: {},
          validationErrors: {},
        },
        position: { x: 500, y: 500 },
      },
    ];

    const result = autoLayoutDiagram(nodes, []);
    const apigw = result.find((n) => n.id === 'apigw-1')!;

    // Ingress elements are aligned to the left of the canvas
    expect(apigw.position.x).toBe(50);
  });
});
