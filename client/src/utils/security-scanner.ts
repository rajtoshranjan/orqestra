import type { DiagramNode, DiagramEdge } from '@/types';

export type SecurityWarning = {
  id: string;
  severity: 'high' | 'medium' | 'info';
  title: string;
  description: string;
  resourceId?: string;
};

export function scanSecurityRisks(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
): SecurityWarning[] {
  const warnings: SecurityWarning[] = [];

  for (const node of nodes) {
    const serviceId = node.data.serviceId;
    const config = (node.data.config || {}) as any;
    const name = node.data.label || node.id;

    // 1. Check for Public Function URL on Lambda
    if (serviceId === 'lambda') {
      if (config.enableFunctionUrl && config.functionUrlAuthType === 'NONE') {
        warnings.push({
          id: `sec-url-${node.id}`,
          severity: 'high',
          title: 'Public Unauthenticated Function URL',
          description: `Lambda function "${name}" has a public unauthenticated HTTPS endpoint enabled. This allows anyone on the internet to invoke your function.`,
          resourceId: node.id,
        });
      }

      // Check if Lambda is connected to any public subnet
      const subnetEdges = edges.filter(
        (e) => e.source === node.id || e.target === node.id,
      );
      for (const edge of subnetEdges) {
        const otherId = edge.source === node.id ? edge.target : edge.source;
        const otherNode = nodes.find((n) => n.id === otherId);
        if (otherNode && otherNode.data.serviceId === 'subnet') {
          if (otherNode.data.config?.subnetType === 'public') {
            warnings.push({
              id: `sec-sub-${node.id}-${otherNode.id}`,
              severity: 'medium',
              title: 'Lambda Hosted in Public Subnet',
              description: `Lambda function "${name}" is connected to public subnet "${otherNode.data.label}". Serverless resources should reside in private subnets for network isolation.`,
              resourceId: node.id,
            });
          }
        }
      }
    }

    // 2. Check for Open Security Groups
    if (serviceId === 'security-group') {
      const ingress = config.ingressRules || [];
      const hasWildcardIngress = ingress.some(
        (rule: any) => rule.cidrBlock === '0.0.0.0/0',
      );
      if (hasWildcardIngress) {
        warnings.push({
          id: `sec-sg-${node.id}`,
          severity: 'medium',
          title: 'Open Ingress Firewall Rules',
          description: `Security group "${name}" allows incoming traffic from any IP (0.0.0.0/0). Ensure this is intentional for production networks.`,
          resourceId: node.id,
        });
      }
    }

    // 3. Check for Wildcard Policies in IAM Roles
    if (serviceId === 'iam-role') {
      const trust = config.assumeRolePolicyDocument || '';
      if (
        trust.includes('"Action": "*"') ||
        trust.includes('"Resource": "*"')
      ) {
        warnings.push({
          id: `sec-iam-trust-${node.id}`,
          severity: 'high',
          title: 'Wildcard Actions in Trust Policy',
          description: `IAM Role "${name}" contains wildcard actions or resources in its assume-role trust document.`,
          resourceId: node.id,
        });
      }

      const inline = config.inlinePolicies || [];
      const hasWildcardInline = inline.some(
        (policy: any) =>
          policy.document?.includes('"Action": "*"') ||
          policy.document?.includes('"Resource": "*"') ||
          policy.document?.includes('"*": "*"'),
      );
      if (hasWildcardInline) {
        warnings.push({
          id: `sec-iam-inline-${node.id}`,
          severity: 'high',
          title: 'Overly Broad IAM Policy Permissions',
          description: `IAM Role "${name}" has inline policies with wildcard "*" actions or resources.`,
          resourceId: node.id,
        });
      }
    }
  }

  return warnings;
}
