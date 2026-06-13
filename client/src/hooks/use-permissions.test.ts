import { describe, it, expect } from 'vitest';

import { derivePermissions } from './use-permissions';

describe('derivePermissions', () => {
  it('grants an owner every capability', () => {
    expect(derivePermissions('owner')).toEqual({
      role: 'owner',
      isOwner: true,
      isAdmin: false,
      isGuest: false,
      canWrite: true,
      canManage: true,
      canModerate: true,
      canDeleteOrg: true,
    });
  });

  it('lets an admin write, manage, and moderate but not delete the org', () => {
    const perms = derivePermissions('admin');
    expect(perms.canWrite).toBe(true);
    expect(perms.canManage).toBe(true);
    expect(perms.canModerate).toBe(true);
    expect(perms.canDeleteOrg).toBe(false);
  });

  it('lets a regular member write but not manage or moderate', () => {
    const perms = derivePermissions('regular');
    expect(perms.canWrite).toBe(true);
    expect(perms.canManage).toBe(false);
    expect(perms.canModerate).toBe(false);
    expect(perms.canDeleteOrg).toBe(false);
  });

  it('gives a guest read-only access (no write/manage/moderate)', () => {
    const perms = derivePermissions('guest');
    expect(perms.isGuest).toBe(true);
    expect(perms.canWrite).toBe(false);
    expect(perms.canManage).toBe(false);
    expect(perms.canModerate).toBe(false);
    expect(perms.canDeleteOrg).toBe(false);
  });

  it('treats an unknown/undefined role as no access', () => {
    const perms = derivePermissions(undefined);
    expect(perms.role).toBeUndefined();
    expect(perms.canWrite).toBe(false);
    expect(perms.canManage).toBe(false);
    expect(perms.canModerate).toBe(false);
    expect(perms.canDeleteOrg).toBe(false);
  });
});
