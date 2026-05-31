import React, { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from '@/components/ui';
import { useAppDispatch, useAppSelector } from '@/store';
import { setProjectName, setProjectDescription } from '@/store/editor-slice';

type ProjectSettingsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ProjectSettingsModal({
  open,
  onOpenChange,
}: ProjectSettingsModalProps) {
  const dispatch = useAppDispatch();
  const { projectName, projectDescription } = useAppSelector(
    (state) => state.editor,
  );

  const [editName, setEditName] = React.useState('');
  const [editDesc, setEditDesc] = React.useState('');

  useEffect(() => {
    if (open) {
      setEditName(projectName);
      setEditDesc(projectDescription || '');
    }
  }, [open, projectName, projectDescription]);

  const saveSettings = () => {
    dispatch(setProjectName(editName));
    dispatch(setProjectDescription(editDesc));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Project Settings</DialogTitle>
          <DialogDescription>
            Update your project&apos;s name and description.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label htmlFor="name" className="text-sm font-medium">
              Project Name
            </label>
            <input
              id="name"
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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
