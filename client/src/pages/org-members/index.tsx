import { useState } from 'react';

import {
  ChevronDown,
  Shield,
  Trash2,
  UserPlus,
  Users,
  Check,
} from 'lucide-react';
import { useLocalStorage } from 'usehooks-ts';

import {
  useOrganisations,
  useOrganisationMembers,
  useAddOrganisationMember,
  useRemoveOrganisationMember,
  useGetUserInfo,
  useUpdateOrganisationMember,
} from '@/api/auth';
import { PageLayout } from '@/components';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
  Badge,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { localStorageManager } from '@/lib/utils/local-storage-manager';

/**
 * Computes the first letters of the user or organisation name to render custom avatars.
 */
const ROLE_OPTIONS = [
  {
    value: 'admin' as const,
    label: 'Administrator',
    desc: 'Full access to manage organisation settings, invite members, and edit projects.',
  },
  {
    value: 'regular' as const,
    label: 'Regular Member',
    desc: 'Can view, create and manage projects. Cannot edit settings or invite members.',
  },
  {
    value: 'guest' as const,
    label: 'Guest / Viewer',
    desc: 'Read-only access to browse projects. Cannot make edits or trigger deployments.',
  },
];

const getInitials = (name?: string): string => {
  if (!name) {
    return 'U';
  }

  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export function OrgMembers() {
  const isAuthenticated = localStorageManager.hasToken();

  // Fetch backend query states and active mutations.
  const { data: user } = useGetUserInfo(isAuthenticated);
  const { data: organisations } = useOrganisations(isAuthenticated);
  const { data: members, isLoading: isMembersLoading } =
    useOrganisationMembers(isAuthenticated);

  const inviteMutation = useAddOrganisationMember();
  const removeMutation = useRemoveOrganisationMember();
  const updateRoleMutation = useUpdateOrganisationMember();

  const [activeOrgId] = useLocalStorage<string | null>('activeOrgId', null);
  const activeOrganisation =
    organisations?.find((organisation) => organisation.id === activeOrgId) ||
    organisations?.[0];

  // Manage invite field state.
  const [inviteEmail, setInviteEmail] = useState<string>('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'regular' | 'guest'>(
    'regular',
  );

  // Track selection for removing organisation members.
  const [memberToRemove, setMemberToRemove] = useState<{
    id: string;
    email: string;
  } | null>(null);

  const handleInviteMember = (event: React.FormEvent) => {
    event.preventDefault();
    if (!inviteEmail.trim()) return;

    inviteMutation.mutate(
      { email: inviteEmail.trim(), role: inviteRole },
      {
        onSuccess: () => {
          toast({
            title: 'Success',
            description: `Invited ${inviteEmail.trim()} successfully.`,
          });
          setInviteEmail('');
        },
        onError: (error: any) => {
          const errorMsg =
            error.response?.data?.email?.[0] ||
            error.response?.data?.email ||
            error.response?.data?.detail ||
            'Failed to invite member. Please verify if they have an active account.';
          toast({
            title: 'Error',
            description: errorMsg,
            variant: 'destructive',
          });
        },
      },
    );
  };

  const handleRemoveMember = () => {
    if (!memberToRemove) return;
    removeMutation.mutate(memberToRemove.id, {
      onSuccess: () => {
        toast({
          title: 'Member removed',
          description: `${memberToRemove.email} removed from organisation.`,
        });
        setMemberToRemove(null);
      },
      onError: (error: any) => {
        const errorMsg =
          error.response?.data?.detail ||
          error.message ||
          'Failed to remove member.';
        toast({
          title: 'Error',
          description: errorMsg,
          variant: 'destructive',
        });
        setMemberToRemove(null);
      },
    });
  };

  const handleUpdateRole = (
    memberId: string,
    role: 'admin' | 'regular' | 'guest',
  ) => {
    updateRoleMutation.mutate(
      { memberId, role },
      {
        onSuccess: () => {
          toast({
            title: 'Success',
            description: 'Member role updated successfully.',
          });
        },
        onError: (error: any) => {
          const errorMsg =
            error.response?.data?.detail ||
            error.message ||
            'Failed to update member role.';
          toast({
            title: 'Error',
            description: errorMsg,
            variant: 'destructive',
          });
        },
      },
    );
  };

  const canManageMembers =
    activeOrganisation?.role === 'owner' ||
    activeOrganisation?.role === 'admin';

  // Prepend the organisation owner to the directory manually.
  const ownerEntry =
    activeOrganisation?.role === 'owner' && user
      ? [
          {
            id: 'owner',
            userName: user.name,
            userEmail: user.email,
            role: 'owner' as const,
          },
        ]
      : [];

  const displayedMembers = [...ownerEntry, ...(members ?? [])];

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isEmailEmpty = !inviteEmail.trim();
  const isValidEmail = isEmailEmpty || emailRegex.test(inviteEmail.trim());

  return (
    <PageLayout
      title="Organisation members"
      description="Manage your organisation members, invite new colleagues, and assign roles."
      maxWidthClass="max-w-4xl"
    >
      <div className="space-y-6">
        {canManageMembers && (
          <Card className="border-border/80 bg-[var(--color-bg-surface)] shadow-none">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                <UserPlus className="size-4 text-primary" />
                Invite Team Member
              </CardTitle>
              <CardDescription className="text-xs">
                Invite users to collaborate on this organisation. They must
                already have an account.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <form onSubmit={handleInviteMember} className="space-y-4">
                <div className="grid items-end gap-4 sm:grid-cols-3">
                  <div className="space-y-1 sm:col-span-2">
                    <label
                      htmlFor="invite-email"
                      className="text-xs font-semibold text-muted-foreground"
                    >
                      Email Address
                    </label>
                    <Input
                      id="invite-email"
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                      placeholder="colleague@example.com"
                      className={cn(
                        'h-10 border-border bg-background/50 text-sm focus-visible:ring-primary',
                        !isValidEmail &&
                          'border-destructive focus-visible:ring-destructive',
                      )}
                    />
                    {!isValidEmail && (
                      <p className="text-[10px] text-destructive">
                        Please enter a valid email address.
                      </p>
                    )}
                  </div>
                  <div>
                    <Button
                      type="submit"
                      className="h-10 w-full text-xs font-semibold"
                      disabled={
                        inviteMutation.isPending ||
                        isEmailEmpty ||
                        !emailRegex.test(inviteEmail.trim())
                      }
                    >
                      {inviteMutation.isPending
                        ? 'Sending...'
                        : 'Invite Member'}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Select Member Role
                  </label>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {ROLE_OPTIONS.map((roleOption) => {
                      const isSelected = inviteRole === roleOption.value;
                      return (
                        <button
                          key={roleOption.value}
                          type="button"
                          onClick={() => setInviteRole(roleOption.value as any)}
                          className={cn(
                            'flex flex-col rounded-lg border p-3 text-left transition-all duration-150',
                            isSelected
                              ? 'border-primary bg-primary/5 ring-1 ring-primary'
                              : 'hover:border-border-hover border-border bg-background/20 hover:bg-background/40',
                          )}
                        >
                          <span className="flex w-full items-center justify-between text-xs font-bold text-foreground">
                            <span className="flex items-center gap-1.5">
                              {roleOption.label}
                              {roleOption.value === 'admin' && (
                                <Shield className="size-3.5 text-primary" />
                              )}
                            </span>
                            {isSelected && (
                              <Check className="animate-scale-in size-3.5 text-primary" />
                            )}
                          </span>
                          <span className="mt-1 text-[10px] leading-normal text-muted-foreground">
                            {roleOption.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className="border-border/80 bg-[var(--color-bg-surface)] shadow-none">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Users className="size-4 text-primary" />
              Organisation Directory
            </CardTitle>
            <CardDescription className="text-xs">
              An overview of all users currently in this organisation.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            {isMembersLoading ? (
              <div className="flex h-32 items-center justify-center">
                <span className="animate-pulse text-xs text-muted-foreground">
                  Loading members directory...
                </span>
              </div>
            ) : displayedMembers.length === 0 ? (
              <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border p-4 text-center">
                <span className="text-xs text-muted-foreground">
                  No members found. Invite colleagues to get started!
                </span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-border pb-2 text-muted-foreground">
                      <th className="pb-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                        Member
                      </th>
                      <th className="pb-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                        Role
                      </th>
                      {canManageMembers && (
                        <th className="pb-3 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {displayedMembers.map((member) => {
                      const isSelf = user && member.userEmail === user.email;
                      const isOwner = member.role === 'owner';
                      return (
                        <tr
                          key={member.id}
                          className="transition-colors hover:bg-accent/10"
                        >
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-3">
                              <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/10 bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 text-xs font-bold uppercase text-primary">
                                {getInitials(member.userName)}
                              </span>
                              <div className="min-w-0">
                                <span className="block text-xs font-semibold leading-none text-foreground">
                                  {member.userName}{' '}
                                  {isSelf && (
                                    <span className="text-[10px] font-normal text-muted-foreground">
                                      (You)
                                    </span>
                                  )}
                                </span>
                                <span className="mt-0.5 block text-[11px] leading-normal text-muted-foreground">
                                  {member.userEmail}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-3">
                            {canManageMembers && !isOwner && !isSelf ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    disabled={updateRoleMutation.isPending}
                                    className="group flex items-center gap-1 rounded-full border border-border/80 bg-background/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground transition-all hover:border-primary/30 hover:bg-background/40 hover:text-foreground focus:outline-none disabled:opacity-50"
                                  >
                                    <span
                                      className={cn(
                                        member.role === 'admin' && 'text-error',
                                        member.role === 'regular' &&
                                          'text-primary',
                                        member.role === 'guest' &&
                                          'text-muted-foreground',
                                      )}
                                    >
                                      {member.role}
                                    </span>
                                    <ChevronDown className="size-2.5 transition-transform duration-200 group-hover:translate-y-0.5" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  className="w-40 border-border bg-[var(--color-bg-surface)] text-foreground"
                                  align="start"
                                >
                                  {ROLE_OPTIONS.map((roleOpt) => (
                                    <DropdownMenuItem
                                      key={roleOpt.value}
                                      onClick={() =>
                                        handleUpdateRole(
                                          member.id,
                                          roleOpt.value as any,
                                        )
                                      }
                                      disabled={member.role === roleOpt.value}
                                      className={cn(
                                        'flex cursor-pointer items-center justify-between px-2.5 py-1.5 text-xs text-foreground hover:bg-accent/50 focus:bg-accent/50',
                                        member.role === roleOpt.value &&
                                          'cursor-default font-bold text-primary opacity-60',
                                      )}
                                    >
                                      {roleOpt.label}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <Badge
                                className={cn(
                                  'rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider shadow-none',
                                  isOwner &&
                                    'border-purple-500/20 bg-purple-500/10 text-purple-400',
                                  member.role === 'admin' &&
                                    'bg-error/10 text-error border-error/20',
                                  member.role === 'regular' &&
                                    'border-primary/20 bg-primary/10 text-primary',
                                  member.role === 'guest' &&
                                    'border-border bg-muted text-muted-foreground',
                                )}
                              >
                                {member.role}
                              </Badge>
                            )}
                          </td>
                          {canManageMembers && (
                            <td className="py-3 pl-4 text-right">
                              {!isOwner && !isSelf && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={() =>
                                    setMemberToRemove({
                                      id: member.id,
                                      email: member.userEmail,
                                    })
                                  }
                                  className="hover:text-error hover:bg-error/10 size-8 rounded-md p-0 text-muted-foreground transition-colors"
                                  title={`Remove ${member.userName}`}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Remove Member Confirmation Dialog */}
      <ConfirmDialog
        open={!!memberToRemove}
        onOpenChange={(isOpen) => !isOpen && setMemberToRemove(null)}
        title="Remove Team Member"
        description={`Are you sure you want to remove "${memberToRemove?.email}" from the organisation? They will immediately lose access to all projects and infrastructure layouts.`}
        confirmText="Remove Member"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleRemoveMember}
      />
    </PageLayout>
  );
}
