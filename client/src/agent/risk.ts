import type { AgentRiskLevel } from '@/api/agent';
import { registry } from '@/services';

/**
 * Merge the server's coarse operation-type risk with fine-grained, client-only signal.
 * The cost and security profiles live on the frontend service definitions, so
 * the final risk grade is resolved here, at apply time.
 */

/**
 * Config fields whose value changes blast radius rather than behaviour —
 * exposure, encryption, retention, deletion protection. Matched case- and
 * separator-insensitively so `publiclyAccessible`, `public_access_block` and
 * `PubliclyAccessible` all land. A service can add its own with
 * `sensitiveConfigKeys`.
 */
const SECURITY_SENSITIVE_CONFIG_FRAGMENTS = [
  'public',
  'encrypt',
  'kms',
  'ssl',
  'tls',
  'iamauth',
  'authentication',
  'authorization',
  'policy',
  'principal',
  'cidr',
  'ingress',
  'egress',
  'deletionprotection',
  'retention',
  'backup',
  'multiaz',
  'versioning',
  'logging',
];

/** Fields that change what a resource costs by an order of magnitude. */
const COST_SENSITIVE_CONFIG_FRAGMENTS = [
  'instanceclass',
  'instancetype',
  'nodetype',
  'nodecount',
  'desiredcount',
  'mincapacity',
  'maxcapacity',
  'replicacount',
  'provisioned',
  'storagegb',
  'shardcount',
];

const normalise = (key: string): string =>
  key.toLowerCase().replace(/[_\-\s]/g, '');

function isSensitiveKey(key: string, serviceKeys: string[]): boolean {
  const flat = normalise(key);
  if (serviceKeys.some((declared) => normalise(declared) === flat)) return true;
  return [
    ...SECURITY_SENSITIVE_CONFIG_FRAGMENTS,
    ...COST_SENSITIVE_CONFIG_FRAGMENTS,
  ].some((fragment) => flat.includes(fragment));
}

export function resolveOperationRisk(
  serverRisk: AgentRiskLevel,
  opName: string,
  input: Record<string, unknown>,
): AgentRiskLevel {
  if (serverRisk === 'confirm') return 'confirm';

  if (opName === 'add_resource') {
    const service = registry.find(String(input.service_id ?? ''));
    if (service?.costProfile?.tier === 'high') return 'confirm';
  }

  if (opName === 'configure') {
    const patch = input.config_patch;
    if (patch && typeof patch === 'object') {
      const service = registry.find(String(input.service_id ?? ''));
      const declared = service?.sensitiveConfigKeys ?? [];
      if (Object.keys(patch).some((key) => isSensitiveKey(key, declared))) {
        return 'confirm';
      }
    }
  }

  return 'safe';
}
