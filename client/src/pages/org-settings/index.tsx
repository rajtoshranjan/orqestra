import { useEffect, useState } from 'react';
import { useLocalStorage } from 'usehooks-ts';
import { Building2, History, Search } from 'lucide-react';

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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui';
import { PageLayout } from '@/components';
import {
  useOrganisations,
  useUpdateOrganisation,
  useAuditLogs,
  useDeleteOrganisation,
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
  const deleteOrgMutation = useDeleteOrganisation();

  // Local State
  const [orgName, setOrgName] = useState<string>('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [logSearch, setLogSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Sync org name state
  useEffect(() => {
    setOrgName(activeOrganisation?.name ?? '');
  }, [activeOrganisation?.id, activeOrganisation?.name]);

  // Reset pagination on search change
  useEffect(() => {
    setCurrentPage(1);
  }, [logSearch]);

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

  const handleDeleteOrg = (): void => {
    if (
      !activeOrganisation ||
      confirmName.trim() !== activeOrganisation.name ||
      !isOwner
    ) {
      return;
    }

    deleteOrgMutation.mutate(activeOrganisation.id, {
      onSuccess: () => {
        toast({
          title: 'Organisation deleted',
          description: `The organisation "${activeOrganisation.name}" has been deleted.`,
        });
        setDeleteConfirmOpen(false);
        setConfirmName('');
        window.location.href = '/';
      },
      onError: (error: any) => {
        toast({
          title: 'Error deleting organisation',
          description:
            error.response?.data?.detail ||
            error.message ||
            'Failed to delete organisation.',
          variant: 'destructive',
        });
      },
    });
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

  const renderLogDetails = (details: Record<string, any>) => {
    if (!details || Object.keys(details).length === 0) {
      return <span className="text-muted-foreground">-</span>;
    }
    return (
      <div className="flex flex-wrap gap-1">
        {Object.entries(details).map(([key, val]) => (
          <Badge
            key={key}
            variant="outline"
            className="border-border bg-background/50 px-1.5 py-0.5 font-mono text-[9px] font-normal text-muted-foreground"
          >
            {key}: {typeof val === 'object' ? JSON.stringify(val) : String(val)}
          </Badge>
        ))}
      </div>
    );
  };

  // Filter and paginate logs
  const filteredLogs = auditLogs.filter((log) => {
    const query = logSearch.toLowerCase().trim();
    if (!query) return true;
    return (
      log.action.toLowerCase().includes(query) ||
      (log.actorName && log.actorName.toLowerCase().includes(query)) ||
      (log.actorEmail && log.actorEmail.toLowerCase().includes(query))
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / itemsPerPage));
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

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

          {/* Danger Zone */}
          <Card className="max-w-2xl rounded-lg border-red-500/35 bg-red-500/5 shadow-none">
            <CardHeader className="p-5">
              <CardTitle className="text-base font-bold text-red-500">
                Danger Zone
              </CardTitle>
              <CardDescription className="text-xs text-red-400">
                Permanently delete this organisation and all its project
                designs.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4 p-5 pt-0">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-foreground">
                  Delete this organisation
                </p>
                <p className="text-[10px] leading-normal text-muted-foreground">
                  Once deleted, all data including architectures, layouts, and
                  audit logs will be permanently deleted. This action cannot be
                  undone.
                </p>
              </div>
              <Button
                variant="destructive"
                type="button"
                disabled={!isOwner}
                onClick={() => setDeleteConfirmOpen(true)}
                className="h-9 shrink-0 text-xs font-semibold"
                title={
                  !isOwner
                    ? 'Only organisation owners can delete organisations'
                    : 'Delete organisation'
                }
              >
                Delete Organisation
              </Button>
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
            <CardContent className="space-y-4 p-5 pt-0">
              {/* Search log bar */}
              <div className="relative max-w-sm">
                <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search logs by action or actor..."
                  value={logSearch}
                  onChange={(event) => setLogSearch(event.target.value)}
                  className="h-8 border-border bg-background/50 pl-8 text-xs"
                />
              </div>

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
                    {paginatedLogs.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="p-8 text-center text-muted-foreground"
                        >
                          No audit logs found.
                        </td>
                      </tr>
                    ) : (
                      paginatedLogs.map((log) => (
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
                          <td className="p-3">
                            {renderLogDetails(log.details)}
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

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-muted-foreground">
                    Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
                    {Math.min(currentPage * itemsPerPage, filteredLogs.length)}{' '}
                    of {filteredLogs.length} entries
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(prev - 1, 1))
                      }
                      className="h-7 px-2 text-xs"
                    >
                      Previous
                    </Button>
                    <span className="px-2 text-xs text-muted-foreground">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === totalPages}
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                      }
                      className="h-7 px-2 text-xs"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="border-border bg-[var(--color-bg-surface)] text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-red-500">
              Delete Organisation
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              This action is permanent. Please type{' '}
              <span className="font-bold text-foreground">
                &quot;{activeOrganisation?.name}&quot;
              </span>{' '}
              to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Input
              value={confirmName}
              onChange={(event) => setConfirmName(event.target.value)}
              placeholder={activeOrganisation?.name}
              className="h-9 text-xs"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeleteConfirmOpen(false);
                setConfirmName('');
              }}
              className="h-9 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                confirmName.trim() !== activeOrganisation?.name ||
                deleteOrgMutation.isPending
              }
              onClick={handleDeleteOrg}
              className="h-9 text-xs font-semibold"
            >
              {deleteOrgMutation.isPending
                ? 'Deleting...'
                : 'Permanently Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
