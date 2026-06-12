import { useState } from 'react';

import { Plus, Trash2, Edit2 } from 'lucide-react';

import {
  useAWSAccounts,
  useCreateAWSAccount,
  useUpdateAWSAccount,
  useDeleteAWSAccount,
  type CreateAWSAccountPayload,
  type AWSAccount,
} from '@/api';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  ConfirmDialog,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui';
import { toast } from '@/hooks/use-toast';

type AWSAccountsTabProps = {
  canManage: boolean;
};

export function AWSAccountsTab({ canManage }: AWSAccountsTabProps) {
  const { data: awsAccounts = [] } = useAWSAccounts();
  const createMutation = useCreateAWSAccount();
  const updateMutation = useUpdateAWSAccount();
  const deleteMutation = useDeleteAWSAccount();

  const [formOpen, setFormOpen] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateAWSAccountPayload>({
    name: '',
    accessKeyId: '',
    secretAccessKey: '',
    endpointUrl: '',
  });

  const resetForm = (): void => {
    setFormData({
      name: '',
      accessKeyId: '',
      secretAccessKey: '',
      endpointUrl: '',
    });
    setEditingAccountId(null);
    setShowSecretKey(false);
  };

  const handleDialogOpenChange = (open: boolean): void => {
    setFormOpen(open);
    if (!open) {
      resetForm();
    }
  };

  const handleSaveAccount = async (): Promise<void> => {
    if (
      !formData.name.trim() ||
      !formData.accessKeyId ||
      !formData.secretAccessKey
    ) {
      toast({
        title: 'Validation Error',
        description: 'Name and credentials are required.',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (editingAccountId) {
        await updateMutation.mutateAsync({
          accountId: editingAccountId,
          data: formData,
        });
        toast({
          title: 'Success',
          description: 'AWS account updated successfully.',
        });
      } else {
        await createMutation.mutateAsync(formData);
        toast({
          title: 'Success',
          description: 'AWS account created successfully.',
        });
      }
      handleDialogOpenChange(false);
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to save AWS account.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteAccount = async (): Promise<void> => {
    if (!accountToDelete) return;
    try {
      await deleteMutation.mutateAsync(accountToDelete);
      toast({
        title: 'Success',
        description: 'AWS account deleted successfully.',
      });
      setDeleteConfirmOpen(false);
      setAccountToDelete(null);
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to delete AWS account.',
        variant: 'destructive',
      });
    }
  };

  const handleEditAccount = (account: AWSAccount): void => {
    setEditingAccountId(account.id);
    setFormData({
      name: account.name,
      accessKeyId: account.accessKeyId,
      secretAccessKey: '',
      endpointUrl: account.endpointUrl || '',
    });
    setFormOpen(true);
  };

  const handleNewAccount = (): void => {
    resetForm();
    setFormOpen(true);
  };

  return (
    <>
      <Card className="rounded-lg border-border bg-[var(--color-bg-surface)] shadow-none">
        <CardHeader className="flex flex-row items-center justify-between p-5">
          <div>
            <CardTitle className="text-base font-bold text-foreground">
              AWS Accounts
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Register and manage AWS accounts for your organisation.
            </CardDescription>
          </div>
          {canManage && (
            <Button onClick={handleNewAccount} size="sm" className="h-8 gap-1">
              <Plus className="size-3.5" />
              Add Account
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4 p-5 pt-0">
          {awsAccounts.length === 0 ? (
            <div className="rounded-md bg-muted/50 p-4 text-center text-sm text-muted-foreground">
              No AWS accounts configured yet. Add one to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Access Key ID</TableHead>
                  <TableHead>Endpoint URL</TableHead>
                  <TableHead>Created</TableHead>
                  {canManage && (
                    <TableHead className="text-right">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {awsAccounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-semibold text-foreground">
                      {account.name}
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      {account.accessKeyId}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {account.endpointUrl || '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(account.createdAt).toLocaleDateString()}
                    </TableCell>
                    {canManage && (
                      <TableCell className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditAccount(account)}
                          className="size-6"
                          title="Edit account"
                        >
                          <Edit2 className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setAccountToDelete(account.id);
                            setDeleteConfirmOpen(true);
                          }}
                          className="size-6 text-destructive hover:bg-destructive/10"
                          title="Delete account"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingAccountId ? 'Edit AWS Account' : 'Add AWS Account'}
            </DialogTitle>
            <DialogDescription>
              {editingAccountId
                ? 'Update your AWS account credentials and endpoint.'
                : 'Register a new AWS account for your organisation.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="name" className="text-xs font-semibold">
                Account Name
              </label>
              <Input
                id="name"
                placeholder="e.g., Production"
                value={formData.name}
                onChange={(event) =>
                  setFormData({ ...formData, name: event.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="access-key-id" className="text-xs font-semibold">
                Access Key ID
              </label>
              <Input
                id="access-key-id"
                placeholder="AKIA..."
                value={formData.accessKeyId}
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    accessKeyId: event.target.value,
                  })
                }
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="secret-key" className="text-xs font-semibold">
                Secret Access Key
              </label>
              <div className="relative">
                <Input
                  id="secret-key"
                  type={showSecretKey ? 'text' : 'password'}
                  placeholder="••••••••••••••••"
                  value={formData.secretAccessKey}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      secretAccessKey: event.target.value,
                    })
                  }
                  className="pr-8"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSecretKey(!showSecretKey)}
                  className="absolute right-1 top-1/2 size-6 -translate-y-1/2"
                >
                  {showSecretKey ? '👁️' : '👁️‍🗨️'}
                </Button>
              </div>
            </div>
            <div className="grid gap-2">
              <label htmlFor="endpoint-url" className="text-xs font-semibold">
                Endpoint URL (Optional)
              </label>
              <Input
                id="endpoint-url"
                placeholder="e.g., http://localstack:4566"
                value={formData.endpointUrl}
                onChange={(event) =>
                  setFormData({ ...formData, endpointUrl: event.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleDialogOpenChange(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveAccount}>
              {editingAccountId ? 'Update Account' : 'Add Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete AWS Account"
        description="Are you sure you want to delete this AWS account? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleDeleteAccount}
      />
    </>
  );
}
