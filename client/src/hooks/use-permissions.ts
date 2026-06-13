import { useLocalStorage } from 'usehooks-ts';

import { useOrganisations } from '@/api/auth';
import type { OrganisationInfo } from '@/api/auth';
import { localStorageManager } from '@/lib/utils/local-storage-manager';

export type OrgRole = 'owner' | 'admin' | 'regular' | 'guest';

export type Permissions = {
  /** The current user's role in the active organisation, if known. */
  role: OrgRole | undefined;
  isOwner: boolean;
  isAdmin: boolean;
  isGuest: boolean;
  /** Can create/edit/delete projects and trigger deployments (owner/admin/regular). */
  canWrite: boolean;
  /** Can manage org settings, members, and AWS accounts (owner/admin). */
  canManage: boolean;
  /** Can moderate others' comments (owner/admin). */
  canModerate: boolean;
  /** Can delete the organisation (owner only). */
  canDeleteOrg: boolean;
};

/**
 * Pure mapping from an organisation role to capability booleans. Mirrors the
 * backend permission classes in `server/organisations/permissions.py` so the
 * UI never surfaces an action the server will reject. Kept separate from the
 * hook so it can be unit-tested without React.
 */
export function derivePermissions(role: OrgRole | undefined): Permissions {
  const isOwner = role === 'owner';
  const isAdmin = role === 'admin';
  const isGuest = role === 'guest';
  const canManage = isOwner || isAdmin;

  return {
    role,
    isOwner,
    isAdmin,
    isGuest,
    canWrite: isOwner || isAdmin || role === 'regular',
    canManage,
    canModerate: canManage,
    canDeleteOrg: isOwner,
  };
}

/**
 * Resolves the active organisation the same way every page does: the org
 * matching the persisted `activeOrgId`, falling back to the first org.
 */
export function useActiveOrganisation(): OrganisationInfo | undefined {
  const isAuthenticated = localStorageManager.hasToken();
  const { data: organisations } = useOrganisations(isAuthenticated);
  const [activeOrgId] = useLocalStorage<string | null>('activeOrgId', null);

  return (
    organisations?.find((organisation) => organisation.id === activeOrgId) ??
    organisations?.[0]
  );
}

/**
 * Single source of truth for role-based UI gating. Use the returned booleans
 * to disable/hide controls rather than re-deriving role checks per component.
 */
export function usePermissions(): Permissions {
  const activeOrganisation = useActiveOrganisation();
  return derivePermissions(activeOrganisation?.role);
}
