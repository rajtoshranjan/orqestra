import { useState } from 'react';

import {
  ChevronDown,
  Shield,
  Trash2,
  UserPlus,
  Users,
  Check,
} from 'lucide-react';

import {
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
  LoadingState,
} from '@/components/ui';
import { usePermissions, useActiveOrganisation } from '@/hooks';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { localStorageManager } from '@/lib/utils/local-storage-manager';
import { getInitials } from '@/utils';

import { canSubmitInvite } from './invite';

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
    label: 'Regular member',
    desc: 'Can view, create and manage projects. Cannot edit settings or invite members.',
  },
  {
    value: 'guest' as const,
    label: 'Guest / viewer',
    desc: 'Read-only access to browse projects. Cannot make edits or trigger deployments.',
  },
];

export function OrgMembers() {
  const isAuthenticated = localStorageManager.hasToken();

  const { canManage: canManageMembers, isGuest } = usePermissions();

  // Fetch backend query states and active mutations. The member directory is
  // hidden from guests, so skip the request for them.
  const { data: user } = useGetUserInfo(isAuthenticated);
  const { data: members, isLoading: isMembersLoading } = useOrganisationMembers(
    isAuthenticated && !isGuest,
  );

  const inviteMutation = useAddOrganisationMember();
  const removeMutation = useRemoveOrganisationMember();
  const updateRoleMutation = useUpdateOrganisationMember();

  const activeOrganisation = useActiveOrganisation();

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
            title: 'Member invited',
            description: `Invited ${inviteEmail.trim()}.`,
          });
          setInviteEmail('');
        },
        onError: (error: any) => {
          const errorMsg =
            error.response?.data?.email?.[0] ||
            error.response?.data?.email ||
            error.response?.data?.detail ||
            'We couldn’t send the invite. Check that they already have an account.';
          toast({
            title: 'Invitation failed',
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
          description: `Removed ${memberToRemove.email} from the organisation.`,
        });
        setMemberToRemove(null);
      },
      onError: (error: any) => {
        const errorMsg =
          error.response?.data?.detail ||
          error.message ||
          'We couldn’t remove this member. Please try again.';
        toast({
          title: 'Couldn’t remove member',
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
            title: 'Role updated',
            description: 'The member’s role has been updated.',
          });
        },
        onError: (error: any) => {
          const errorMsg =
            error.response?.data?.detail ||
            error.message ||
            'We couldn’t update the role. Please try again.';
          toast({
            title: 'Couldn’t update role',
            description: errorMsg,
            variant: 'destructive',
          });
        },
      },
    );
  };

  // Prepend the organisation owner to the directory. The owner is not a member
  // row, so surface it from the org payload for every viewer (not just the
  // owner) — otherwise admins never see who owns the organisation.
  const ownerEntry = activeOrganisation?.ownerEmail
    ? [
        {
          id: 'owner',
          userName: activeOrganisation.ownerName ?? 'Owner',
          userEmail: activeOrganisation.ownerEmail,
          role: 'owner' as const,
        },
      ]
    : [];

  const displayedMembers = [...ownerEntry, ...(members ?? [])];

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isEmailEmpty = !inviteEmail.trim();
  const isValidEmail = isEmailEmpty || emailRegex.test(inviteEmail.trim());

  // Guests have read-only access and cannot view the member directory.
  if (isGuest) {
    return (
      <PageLayout
        title="Organisation members"
        description="Invite people to your organisation and manage their roles."
        maxWidthClass="max-w-4xl"
      >
        <Card className="border-border/80 bg-card shadow-none">
          <CardContent className="flex h-40 flex-col items-center justify-center gap-2 text-center">
            <Shield className="size-5 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">
              Restricted access
            </p>
            <p className="max-w-xs text-xs text-muted-foreground">
              You have read-only access to this organisation and cannot view the
              members directory.
            </p>
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Organisation members"
      description="Invite people to your organisation and manage their roles."
      maxWidthClass="max-w-4xl"
    >
      <div className="space-y-6">
        {canManageMembers && (
          <Card className="border-border/80 bg-card shadow-none">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                <UserPlus className="size-4 text-primary" />
                Invite team member
              </CardTitle>
              <CardDescription className="text-xs">
                Invite users to collaborate on this organisation. They must
                already have an account.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <form onSubmit={handleInviteMember} className="space-y-4">
                {/* Step 1: Email */}
                <div className="space-y-1">
                  <label
                    htmlFor="invite-email"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Email address
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
                    <p className="text-xs text-destructive">
                      Please enter a valid email address.
                    </p>
                  )}
                </div>

                {/* Step 2: Role */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Select member role
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
                          <span className="mt-1 text-xs leading-normal text-muted-foreground">
                            {roleOption.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Step 3: Submit */}
                <div className="flex justify-end pt-1">
                  <Button
                    type="submit"
                    className="h-10 text-xs font-semibold sm:min-w-40"
                    disabled={
                      inviteMutation.isPending ||
                      !canSubmitInvite({ email: inviteEmail, role: inviteRole })
                    }
                  >
                    {inviteMutation.isPending ? 'Sending…' : 'Invite member'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className="border-border/80 bg-card shadow-none">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Users className="size-4 text-primary" />
              Organisation directory
            </CardTitle>
            <CardDescription className="text-xs">
              An overview of all users currently in this organisation.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            {isMembersLoading ? (
              <LoadingState variant="skeleton-card" count={4} />
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
                                {getInitials(member.userName || 'U')}
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
                                  className="w-40 border-border bg-card text-foreground"
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
        title="Remove team member"
        description={`Remove ${memberToRemove?.email} from the organisation? They’ll immediately lose access to all projects.`}
        confirmText="Remove Member"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleRemoveMember}
      />
    </PageLayout>
  );
}
