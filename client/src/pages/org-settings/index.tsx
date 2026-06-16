import { useEffect, useState } from 'react';

import {
  AlertTriangle,
  Building2,
  Check,
  ChevronRight,
  Cloud,
  Copy,
  History,
  Loader2,
  Lock,
  Search,
} from 'lucide-react';

import {
  useUpdateOrganisation,
  useAuditLogs,
  useDeleteOrganisation,
  type AuditLogEntry,
} from '@/api';
import { PageLayout } from '@/components';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
  LoadingState,
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
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui';
import { usePermissions, useActiveOrganisation } from '@/hooks';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import { AWSAccountsTab } from './aws-accounts-tab';

interface CopyButtonProps {
  value: string;
  className?: string;
}

function CopyButton({ value, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={handleCopy}
      className={cn(
        'size-6 h-6 rounded border-border bg-background text-muted-foreground hover:bg-muted',
        className,
      )}
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="size-3 text-success animate-in fade-in zoom-in" />
      ) : (
        <Copy className="size-3 animate-in fade-in" />
      )}
    </Button>
  );
}

export function OrgSettings() {
  const activeOrganisation = useActiveOrganisation();
  const { isOwner, isGuest, canManage } = usePermissions();

  const updateOrganisationMutation = useUpdateOrganisation();
  const deleteOrgMutation = useDeleteOrganisation();

  const [orgName, setOrgName] = useState<string>('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [logSearch, setLogSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const ITEMS_PER_PAGE = 8;

  // AWS accounts and audit logs are hidden from guests; the log list is
  // paginated and searched on the server.
  const auditLogsQuery = useAuditLogs(
    { page: currentPage, pageSize: ITEMS_PER_PAGE, search: debouncedSearch },
    !!activeOrganisation && !isGuest,
  );
  const auditLogs = auditLogsQuery.data?.results ?? [];
  const totalLogCount = auditLogsQuery.data?.count ?? 0;

  useEffect(() => {
    setOrgName(activeOrganisation?.name ?? '');
  }, [activeOrganisation?.id, activeOrganisation?.name]);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(logSearch), 300);
    return () => clearTimeout(handle);
  }, [logSearch]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  const handleUpdateOrgName = (event: React.FormEvent): void => {
    event.preventDefault();
    if (!activeOrganisation || !orgName.trim() || !canManage) return;

    updateOrganisationMutation.mutate(
      { organisationId: activeOrganisation.id, name: orgName.trim() },
      {
        onSuccess: () => {
          toast({
            title: 'Organisation updated',
            description: 'Your changes have been saved.',
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

  const renderActionBadge = (action: string, hasError: boolean) => {
    let baseColor = 'border-border bg-muted/30 text-muted-foreground';
    let dotColor = 'bg-muted-foreground/50';

    if (
      hasError ||
      action.includes('delete') ||
      action.includes('remove') ||
      action.includes('failed')
    ) {
      baseColor = 'border-destructive/20 bg-destructive/10 text-destructive';
      dotColor = 'bg-destructive';
    } else if (
      action.includes('complete') ||
      action.includes('success') ||
      action.includes('resolve')
    ) {
      baseColor = 'border-success/20 bg-success/10 text-success';
      dotColor = 'bg-success';
    } else if (
      action.includes('trigger') ||
      action.includes('create') ||
      action.includes('add')
    ) {
      baseColor = 'border-primary/20 bg-primary/10 text-primary';
      dotColor = 'bg-primary';
    } else if (action.includes('update') || action.includes('edit')) {
      baseColor = 'border-warning/20 bg-warning/10 text-warning';
      dotColor = 'bg-warning';
    } else if (action.includes('aws')) {
      baseColor = 'border-warning/20 bg-warning/10 text-warning';
      dotColor = 'bg-warning';
    }

    return (
      <Badge
        variant="outline"
        className={`inline-flex items-center gap-1.5 border px-1.5 py-0.5 font-mono text-[9px] font-medium leading-none ${baseColor}`}
      >
        <span className={`size-1 rounded-full ${dotColor}`} />
        {action}
      </Badge>
    );
  };

  const getRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 10) return 'just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay === 1) return 'yesterday';
    if (diffDay < 7) return `${diffDay}d ago`;

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  };

  const renderTimeCell = (createdAt: string) => {
    const fullDate = new Date(createdAt).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-default whitespace-nowrap border-b border-dashed border-muted-foreground/30 pb-0.5 text-xs text-muted-foreground">
              {getRelativeTime(createdAt)}
            </span>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            align="end"
            className="font-mono text-[10px]"
          >
            {fullDate}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const renderLogDetailsPreview = (
    details: Record<string, unknown>,
  ): React.ReactNode => {
    if (!details || Object.keys(details).length === 0) {
      return <span className="text-muted-foreground">-</span>;
    }

    const entries = Object.entries(details);
    const hasError = 'error' in details || details.status === 'failed';
    const errorVal = details.error;

    // Filter out error key for preview badges
    const regularEntries = entries.filter(([key]) => key !== 'error');

    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {hasError && (
          <Badge
            variant="outline"
            className="max-w-[250px] truncate border-destructive/20 bg-destructive/10 px-1.5 py-0.5 font-mono text-[9px] font-medium text-destructive"
            title={String(errorVal || 'Failed')}
          >
            <span className="mr-1 inline-block size-1 rounded-full bg-destructive" />
            error: {typeof errorVal === 'string' ? errorVal : 'failed'}
          </Badge>
        )}
        {regularEntries.slice(0, 2).map(([key, value]) => {
          const valString =
            typeof value === 'object' ? JSON.stringify(value) : String(value);
          const truncatedValue =
            valString.length > 20
              ? `${valString.substring(0, 20)}...`
              : valString;
          return (
            <Badge
              key={key}
              variant="outline"
              className="max-w-[180px] truncate border-border bg-background/50 px-1.5 py-0.5 font-mono text-[9px] font-normal text-muted-foreground"
              title={`${key}: ${valString}`}
            >
              {key}: {truncatedValue}
            </Badge>
          );
        })}
        {regularEntries.length > 2 && (
          <span className="font-mono text-[9px] text-muted-foreground">
            +{regularEntries.length - 2} more
          </span>
        )}
      </div>
    );
  };

  const totalPages = Math.max(1, Math.ceil(totalLogCount / ITEMS_PER_PAGE));

  // Guests have read-only access and cannot view organisation settings.
  if (isGuest) {
    return (
      <PageLayout
        title="Organisation settings"
        description="Manage your organisation’s details, members, and activity log."
        maxWidthClass="max-w-6xl"
      >
        <Card className="max-w-2xl rounded-lg border-border bg-card shadow-none">
          <CardContent className="flex h-40 flex-col items-center justify-center gap-2 text-center">
            <Lock className="size-5 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">
              Restricted access
            </p>
            <p className="max-w-xs text-xs text-muted-foreground">
              You have read-only access to this organisation and cannot view its
              settings.
            </p>
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Organisation settings"
      description="Manage your organisation’s details, members, and activity log."
      maxWidthClass="max-w-6xl"
    >
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-3 rounded-lg border border-border bg-card p-1">
          <TabsTrigger
            value="general"
            className="flex items-center gap-1.5 rounded-md py-1.5 text-xs"
          >
            <Building2 className="size-3.5" />
            General
          </TabsTrigger>
          <TabsTrigger
            value="aws-accounts"
            className="flex items-center gap-1.5 rounded-md py-1.5 text-xs"
          >
            <Cloud className="size-3.5" />
            AWS accounts
          </TabsTrigger>
          <TabsTrigger
            value="logs"
            className="flex items-center gap-1.5 rounded-md py-1.5 text-xs"
          >
            <History className="size-3.5" />
            Audit logs
          </TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-6">
          <Card className="max-w-2xl rounded-lg border-border bg-card shadow-none">
            <CardHeader className="p-5">
              <CardTitle className="text-base font-bold text-foreground">
                Organisation details
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
                    Organisation name
                  </label>
                  <Input
                    id="org-name"
                    value={orgName}
                    onChange={(event) => setOrgName(event.target.value)}
                    placeholder="Acme Inc"
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
                        ? 'Saving…'
                        : 'Save name'}
                    </Button>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="max-w-2xl rounded-lg border-destructive/35 bg-destructive/5 shadow-none">
            <CardHeader className="p-5">
              <CardTitle className="text-base font-bold text-destructive">
                Danger Zone
              </CardTitle>
              <CardDescription className="text-xs text-destructive/70">
                Permanently delete this organisation and all its data —
                architectures, layouts, and audit logs. This action cannot be
                undone.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4 p-5 pt-0">
              <p className="text-xs font-semibold text-foreground">
                Delete this organisation
              </p>
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

        {/* AWS Accounts Tab */}
        <TabsContent value="aws-accounts" className="space-y-6">
          <AWSAccountsTab canManage={canManage} />
        </TabsContent>

        {/* Audit Logs Tab */}
        <TabsContent value="logs" className="space-y-6">
          <Card className="rounded-lg border-border bg-card shadow-none">
            <CardHeader className="p-5">
              <CardTitle className="text-base font-bold text-foreground">
                Audit log
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Track logins, deployments, and configuration changes in this
                organisation.
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
                  className="h-8 border-border bg-background/50 px-8 text-xs"
                />
                {auditLogsQuery.isFetching && !auditLogsQuery.isLoading && (
                  <Loader2 className="absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/4">Action</TableHead>
                    <TableHead className="w-1/4">Actor</TableHead>
                    <TableHead className="w-5/12">Parameters</TableHead>
                    <TableHead className="w-1/12 text-right">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogsQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="p-4">
                        <LoadingState variant="skeleton-card" count={5} />
                      </TableCell>
                    </TableRow>
                  ) : auditLogs.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="p-8 text-center text-muted-foreground"
                      >
                        No audit logs found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    auditLogs.map((log) => {
                      const hasError =
                        'error' in (log.details || {}) ||
                        log.details?.status === 'failed';
                      return (
                        <TableRow
                          key={log.id}
                          className="group cursor-pointer transition-colors hover:bg-muted/40"
                          onClick={() => setSelectedLog(log)}
                        >
                          <TableCell className="font-semibold">
                            {renderActionBadge(log.action, hasError)}
                          </TableCell>
                          <TableCell>
                            <div className="font-semibold text-foreground transition-colors group-hover:text-primary">
                              {log.actorName || 'System'}
                            </div>
                            {log.actorEmail && (
                              <div className="text-[10px] text-muted-foreground">
                                {log.actorEmail}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {renderLogDetailsPreview(
                              log.details as Record<string, unknown>,
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap pr-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {renderTimeCell(log.createdAt)}
                              <ChevronRight className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-muted-foreground">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
                    {Math.min(currentPage * ITEMS_PER_PAGE, totalLogCount)} of{' '}
                    {totalLogCount} entries
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
        <DialogContent className="border-border bg-card text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-destructive">
              Delete organisation
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

      {/* Audit Log Details Drawer */}
      <Sheet
        open={!!selectedLog}
        onOpenChange={(open) => !open && setSelectedLog(null)}
      >
        <SheetContent className="overflow-y-auto border-l border-border bg-card text-foreground sm:max-w-lg">
          <SheetHeader className="space-y-1 border-b border-border pb-4">
            <div className="flex items-center gap-2">
              {selectedLog &&
                renderActionBadge(
                  selectedLog.action,
                  'error' in (selectedLog.details || {}) ||
                    selectedLog.details?.status === 'failed',
                )}
              {selectedLog &&
                ('error' in (selectedLog.details || {}) ||
                  selectedLog.details?.status === 'failed') && (
                  <Badge
                    variant="outline"
                    className="border-destructive/20 bg-destructive/10 text-[9px] text-destructive"
                  >
                    Failed
                  </Badge>
                )}
            </div>
            <SheetTitle className="text-base font-bold tracking-tight text-foreground">
              Audit log details
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              Full details and parameters for this action.
            </SheetDescription>
          </SheetHeader>

          {selectedLog && (
            <div className="space-y-6 py-6">
              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-background/30 p-4 text-xs">
                <div>
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Actor
                  </span>
                  <span className="font-medium text-foreground">
                    {selectedLog.actorName || 'System'}
                  </span>
                  {selectedLog.actorEmail && (
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">
                      {selectedLog.actorEmail}
                    </span>
                  )}
                </div>
                <div>
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Timestamp
                  </span>
                  <span className="font-mono text-foreground">
                    {new Date(selectedLog.createdAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>
                <div className="col-span-2 flex items-center justify-between border-t border-border/60 pt-3">
                  <div>
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Log ID
                    </span>
                    <span className="break-all font-mono text-[10px] text-muted-foreground">
                      {selectedLog.id}
                    </span>
                  </div>
                  <CopyButton value={selectedLog.id} className="size-7 h-7" />
                </div>
              </div>

              {/* Error Section if exists */}
              {('error' in selectedLog.details ||
                selectedLog.details.status === 'failed') && (
                <div className="space-y-2 rounded-lg border border-destructive/25 bg-destructive/5 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
                      <AlertTriangle className="size-4" />
                      <span>Execution error</span>
                    </div>
                    <CopyButton
                      value={String(
                        selectedLog.details.error || 'Execution failed',
                      )}
                    />
                  </div>
                  <pre className="max-h-60 overflow-x-auto whitespace-pre-wrap break-all rounded border border-destructive/10 bg-destructive/10 p-2.5 font-mono text-[10px] text-destructive/90">
                    {String(selectedLog.details.error || 'Execution failed')}
                  </pre>
                </div>
              )}

              {/* Full Details Payload */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">
                    Log parameters
                  </span>
                  <CopyButton
                    value={JSON.stringify(selectedLog.details, null, 2)}
                  />
                </div>
                <pre className="max-h-96 overflow-x-auto rounded-lg border border-border bg-background/50 p-4 font-mono text-[10.5px] text-muted-foreground">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </PageLayout>
  );
}
