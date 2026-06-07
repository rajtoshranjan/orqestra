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

import {
  createServerlessApiTemplate,
  createEventDrivenTemplate,
  createSecureVpcTemplate,
  createMicroservicesTemplate,
} from './starters';

describe('starter templates utility tests', () => {
  it('should generate serverless api template with correct nodes and links', () => {
    const { nodes, edges } = createServerlessApiTemplate();

    expect(nodes.length).toBe(4);
    expect(edges.length).toBe(3);

    const serviceIds = nodes.map((n) => n.data.serviceId);
    expect(serviceIds).toContain('api-gateway');
    expect(serviceIds).toContain('lambda');
    expect(serviceIds).toContain('dynamodb');
    expect(serviceIds).toContain('iam-role');
  });

  it('should generate event-driven template with correct nodes and links', () => {
    const { nodes, edges } = createEventDrivenTemplate();

    expect(nodes.length).toBe(5);
    expect(edges.length).toBe(4);

    const serviceIds = nodes.map((n) => n.data.serviceId);
    expect(serviceIds).toContain('s3');
    expect(serviceIds).toContain('sns');
    expect(serviceIds).toContain('sqs');
    expect(serviceIds).toContain('lambda');
  });

  it('should generate secure VPC network layout with hierarchical relationships', () => {
    const { nodes } = createSecureVpcTemplate();

    expect(nodes.length).toBe(6);

    const vpc = nodes.find((n) => n.data.serviceId === 'vpc')!;
    const subnetPub = nodes.find((n) => n.data.label === 'Public Subnet')!;
    const subnetPriv = nodes.find((n) => n.data.label === 'Private Subnet')!;

    expect(subnetPub.parentNode).toBe(vpc.id);
    expect(subnetPriv.parentNode).toBe(vpc.id);
  });

  it('should generate microservices template with correct nodes and links', () => {
    const { nodes, edges } = createMicroservicesTemplate();

    expect(nodes.length).toBe(10);
    expect(edges.length).toBe(6);

    const serviceIds = nodes.map((n) => n.data.serviceId);
    expect(serviceIds).toContain('api-gateway');
    expect(serviceIds).toContain('sqs');
    expect(serviceIds).toContain('lambda');
    expect(serviceIds).toContain('dynamodb');
  });
});
