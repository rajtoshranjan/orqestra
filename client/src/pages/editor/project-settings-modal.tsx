import React, { useEffect } from 'react';

import { useAWSAccounts, useLLMConfigs } from '@/api';
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
import { usePermissions } from '@/hooks';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  setProjectName,
  setProjectDescription,
  setAwsAccountId,
  setLlmConfigId,
} from '@/store/editor-slice';

type ProjectSettingsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ProjectSettingsModal({
  open,
  onOpenChange,
}: ProjectSettingsModalProps) {
  const dispatch = useAppDispatch();
  const { projectName, projectDescription, awsAccountId, llmConfigId } =
    useAppSelector((state) => state.editor);
  const { canWrite } = usePermissions();
  // AWS accounts are not visible to read-only roles; skip the request for them.
  const { data: awsAccounts = [] } = useAWSAccounts(canWrite);
  // Same visibility rule: model configs are hidden from read-only roles.
  const { data: llmConfigs = [] } = useLLMConfigs(canWrite);

  const [editName, setEditName] = React.useState('');
  const [editDesc, setEditDesc] = React.useState('');
  const [editAwsAccountId, setEditAwsAccountId] = React.useState<string | null>(
    null,
  );
  const [editLlmConfigId, setEditLlmConfigId] = React.useState<string | null>(
    null,
  );

  useEffect(() => {
    if (open) {
      setEditName(projectName);
      setEditDesc(projectDescription || '');
      setEditAwsAccountId(awsAccountId || '');
      setEditLlmConfigId(llmConfigId || '');
    }
  }, [open, projectName, projectDescription, awsAccountId, llmConfigId]);

  const defaultModelName = llmConfigs.find((config) => config.isDefault)?.name;

  const saveSettings = () => {
    dispatch(setProjectName(editName));
    dispatch(setProjectDescription(editDesc));
    dispatch(setAwsAccountId(editAwsAccountId || null));
    dispatch(setLlmConfigId(editLlmConfigId || null));
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
              <div className="bg-warning/10 rounded-md p-3 text-sm text-warning">
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

          <div className="space-y-1.5">
            <label
              className="text-xs font-medium text-foreground"
              htmlFor="llmConfig"
            >
              AI model
            </label>
            {llmConfigs.length === 0 ? (
              <div className="bg-warning/10 rounded-md p-3 text-sm text-warning">
                No AI models configured. An owner or admin can add one in
                organisation settings.
              </div>
            ) : (
              <>
                <Select
                  id="llmConfig"
                  value={editLlmConfigId || ''}
                  onChange={(event) =>
                    setEditLlmConfigId(event.target.value || null)
                  }
                >
                  <option value="">
                    Use organisation default
                    {defaultModelName ? ` (${defaultModelName})` : ''}
                  </option>
                  {llmConfigs.map((config) => (
                    <option key={config.id} value={config.id}>
                      {config.name}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-muted-foreground">
                  Which model the agent uses on this project.
                </p>
              </>
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
