import React, { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Select,
} from '@/components/ui';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  setProjectName,
  setProjectDescription,
  setAwsAccountId,
} from '@/store/editor-slice';
import { useAWSAccounts } from '@/api';

type ProjectSettingsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ProjectSettingsModal({
  open,
  onOpenChange,
}: ProjectSettingsModalProps) {
  const dispatch = useAppDispatch();
  const { projectName, projectDescription, awsAccountId } = useAppSelector(
    (state) => state.editor,
  );
  const { data: awsAccounts = [] } = useAWSAccounts();

  const [editName, setEditName] = React.useState('');
  const [editDesc, setEditDesc] = React.useState('');
  const [editAwsAccountId, setEditAwsAccountId] = React.useState<string | null>(
    null,
  );

  useEffect(() => {
    if (open) {
      setEditName(projectName);
      setEditDesc(projectDescription || '');
      setEditAwsAccountId(awsAccountId || '');
    }
  }, [open, projectName, projectDescription, awsAccountId]);

  const saveSettings = () => {
    dispatch(setProjectName(editName));
    dispatch(setProjectDescription(editDesc));
    dispatch(setAwsAccountId(editAwsAccountId || null));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Project Settings</DialogTitle>
          <DialogDescription>
            Update your project&apos;s name, description, and AWS account
            configuration.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label htmlFor="name" className="text-sm font-medium">
              Project Name
            </label>
            <Input
              id="name"
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="description" className="text-sm font-medium">
              Description
            </label>
            <textarea
              id="description"
              value={editDesc}
              onChange={(event) => setEditDesc(event.target.value)}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="awsAccount" className="text-sm font-medium">
              AWS Account
            </label>
            {awsAccounts.length === 0 ? (
              <div className="rounded-md bg-warning/10 p-3 text-sm text-warning">
                No AWS accounts configured. Please set one up in organisation
                settings.
              </div>
            ) : (
              <Select
                id="awsAccount"
                value={editAwsAccountId || ''}
                onChange={(event) =>
                  setEditAwsAccountId(event.target.value || null)
                }
              >
                <option value="">No AWS Account Selected</option>
                {awsAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </Select>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={saveSettings}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
