import { useEffect, useState } from 'react';
import { useLocalStorage } from 'usehooks-ts';
import { Building2, History } from 'lucide-react';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Badge,
} from '@/components/ui';
import { PageLayout } from '@/components';
import {
  useOrganisations,
  useUpdateOrganisation,
  useAuditLogs,
} from '@/api/auth';
import { localStorageManager } from '@/lib/utils/local-storage-manager';
import { toast } from '@/hooks/use-toast';

export function OrgSettings() {
  const isAuthenticated = localStorageManager.hasToken();

  // Queries
  const { data: organisations } = useOrganisations(isAuthenticated);

  const [activeOrgId] = useLocalStorage<string | null>('activeOrgId', null);
  const activeOrganisationId = activeOrgId;
  const activeOrganisation =
    organisations?.find((org) => org.id === activeOrganisationId) ||
    organisations?.[0];

  const { data: auditLogs = [] } = useAuditLogs(!!activeOrganisation);

  // Mutations
  const updateOrganisationMutation = useUpdateOrganisation();

  // Local State
  const [orgName, setOrgName] = useState<string>('');

  // Sync org name state
  useEffect(() => {
    setOrgName(activeOrganisation?.name ?? '');
  }, [activeOrganisation?.id, activeOrganisation?.name]);

  // Authorization checks
  const isOwner = activeOrganisation?.role === 'owner';
  const isAdmin = activeOrganisation?.role === 'admin';
  const canManage = isOwner || isAdmin;

  const handleUpdateOrgName = (event: React.FormEvent): void => {
    event.preventDefault();
    if (!activeOrganisation || !orgName.trim() || !canManage) return;

    updateOrganisationMutation.mutate(
      { organisationId: activeOrganisation.id, name: orgName.trim() },
      {
        onSuccess: () => {
          toast({
            title: 'Success',
            description: 'Organisation details updated',
          });
        },
      },
    );
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes('organisation'))
      return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    if (action.includes('project'))
      return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    if (action.includes('deployment'))
      return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
    if (action.includes('member'))
      return 'bg-teal-500/10 text-teal-400 border-teal-500/20';
    return 'bg-green-500/10 text-green-400 border-green-500/20';
  };

  return (
    <PageLayout
      title="Organisation Settings"
      description="Manage organisation details, role-based access control permissions, and operational logs."
      maxWidthClass="max-w-6xl"
    >
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full max-w-sm grid-cols-2 rounded-lg border border-border bg-[var(--color-bg-surface)] p-1">
          <TabsTrigger
            value="general"
            className="flex items-center gap-1.5 rounded-md py-1.5 text-xs"
          >
            <Building2 className="size-3.5" />
            General
          </TabsTrigger>
          <TabsTrigger
            value="logs"
            className="flex items-center gap-1.5 rounded-md py-1.5 text-xs"
          >
            <History className="size-3.5" />
            Audit Logs
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: General Settings */}
        <TabsContent value="general" className="space-y-6">
          <Card className="max-w-2xl rounded-lg border-border bg-[var(--color-bg-surface)] shadow-none">
            <CardHeader className="p-5">
              <CardTitle className="text-base font-bold text-foreground">
                Organisation Details
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Change the display name of your organisation.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <form onSubmit={handleUpdateOrgName} className="space-y-4">
                <div className="space-y-1">
                  <label
                    htmlFor="org-name"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Organisation Name
                  </label>
                  <Input
                    id="org-name"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="My Organisation"
                    disabled={!canManage}
                    className="h-10 text-sm"
                  />
                </div>
                {canManage && (
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      className="h-9 text-xs"
                      disabled={
                        !orgName.trim() ||
                        updateOrganisationMutation.isPending ||
                        orgName.trim() === activeOrganisation?.name
                      }
                    >
                      {updateOrganisationMutation.isPending
                        ? 'Saving...'
                        : 'Save Name'}
                    </Button>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Audit Logs */}
        <TabsContent value="logs" className="space-y-6">
          <Card className="rounded-lg border-border bg-[var(--color-bg-surface)] shadow-none">
            <CardHeader className="p-5">
              <CardTitle className="text-base font-bold text-foreground">
                Operational Audit Logs
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Track logins, deployment workflows, resource updates, and
                configuration actions executed in this organisation.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-border bg-black/10">
                      <th className="w-1/4 p-3 text-xs font-bold text-muted-foreground">
                        Action
                      </th>
                      <th className="w-1/4 p-3 text-xs font-bold text-muted-foreground">
                        Actor
                      </th>
                      <th className="w-1/3 p-3 text-xs font-bold text-muted-foreground">
                        Parameters
                      </th>
                      <th className="w-1/6 p-3 text-right text-xs font-bold text-muted-foreground">
                        Time
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-xs">
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="p-8 text-center text-muted-foreground"
                        >
                          No audit logs found.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-accent/5">
                          <td className="p-3 font-semibold">
                            <Badge
                              variant="outline"
                              className={`border px-1.5 py-0 font-mono text-[9px] ${getActionBadgeColor(log.action)}`}
                            >
                              {log.action}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <div className="font-semibold text-foreground">
                              {log.actorName || 'System'}
                            </div>
                            {log.actorEmail && (
                              <div className="text-[10px] text-muted-foreground">
                                {log.actorEmail}
                              </div>
                            )}
                          </td>
                          <td className="max-w-sm truncate p-3 font-mono text-[10px] text-muted-foreground">
                            {JSON.stringify(log.details)}
                          </td>
                          <td className="p-3 text-right text-muted-foreground">
                            {new Date(log.createdAt).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
}
