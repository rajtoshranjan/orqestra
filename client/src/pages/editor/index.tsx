import React from 'react';
import { ReactFlowProvider } from 'reactflow';
import { CanvasEditor } from './editor-canvas';
import { useProject } from '@/api';
import { useAppDispatch } from '@/store';
import { setProject } from '@/store/editor-slice';
import {
  setDeploymentSettings,
  setActiveDeploymentId,
} from '@/store/deployment-slice';

type EditorProps = {
  projectId: string;
  onNavigateHome: () => void;
};

export function Editor({ projectId, onNavigateHome }: EditorProps) {
  const { data: project, isLoading, error } = useProject(projectId);
  const dispatch = useAppDispatch();

  React.useEffect(() => {
    if (project) {
      dispatch(setProject(project));
      dispatch(setDeploymentSettings(project.deploymentSettings));
      dispatch(setActiveDeploymentId(null));
    }
  }, [project, dispatch]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-[var(--color-bg-base)] text-[var(--color-text-primary)]">
        <div className="relative flex size-16 items-center justify-center">
          <div className="absolute size-full animate-ping rounded-full bg-violet-600/30 opacity-75"></div>
          <div className="relative size-12 animate-spin rounded-full border-4 border-violet-500 border-t-transparent"></div>
        </div>
        <div className="animate-pulse text-sm font-medium tracking-wide text-[var(--color-text-secondary)]">
          Loading cloud architecture...
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-[var(--color-bg-base)] text-[var(--color-text-primary)]">
        <div className="text-xl font-bold text-destructive">
          Project Not Found
        </div>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Failed to load the cloud diagram from the server.
        </p>
        <button
          onClick={onNavigateHome}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-2 text-sm text-[var(--color-text-primary)] transition hover:bg-[var(--color-bg-hover)]"
        >
          Go Back Home
        </button>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <CanvasEditor initialProject={project} onNavigateHome={onNavigateHome} />
    </ReactFlowProvider>
  );
}
export default Editor;
