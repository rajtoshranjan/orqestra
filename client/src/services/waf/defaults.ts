import type { WafConfig } from './types';

export function createDefaultWafConfig(index: number): WafConfig {
  return {
    webAclName: `web-acl-${index}`,
    scope: 'REGIONAL',
    defaultAction: 'ALLOW',
  };
}

export function getWafDisplayName(config: WafConfig): string {
  return config.webAclName.trim() || 'AWS WAF';
}
