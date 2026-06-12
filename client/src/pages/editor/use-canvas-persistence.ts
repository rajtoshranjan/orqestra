import React from 'react';

import { useUpdateProject } from '@/api';
import { toast } from '@/hooks/use-toast';
import { useAppDispatch } from '@/store';
import { setLastSavedAt } from '@/store/editor-slice';
import type { DiagramNode, DiagramEdge, DeploymentSettings } from '@/types';
import { serializeDiagram } from '@/utils';

import { isDiagramStructureEqual } from './canvas-utils';

export type OriginalProjectSnapshot = {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  deploymentSettings: DeploymentSettings;
  projectName: string;
  projectDescription: string;
  awsAccountId: string | null;
};

type UseCanvasPersistenceOptions = {
  currentProjectId: string;
  projectName: string;
  projectDescription: string;
  awsAccountId: string | null;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  deploymentSettings: DeploymentSettings;
  originalProjectRef: React.MutableRefObject<OriginalProjectSnapshot>;
};

export function useCanvasPersistence({
  currentProjectId,
  projectName,
  projectDescription,
  awsAccountId,
  nodes,
  edges,
  deploymentSettings,
  originalProjectRef,
}: UseCanvasPersistenceOptions) {
  const dispatch = useAppDispatch();
  const updateProjectMutation = useUpdateProject();

  const persistDiagram = React.useCallback(
    async (
      nextProjectId: string,
      nextProjectName: string,
      nextProjectDescription: string,
      nextAwsAccountId: string | null,
      nextNodes: DiagramNode[],
      nextEdges: DiagramEdge[],
      nextSettings: DeploymentSettings,
      silent = false,
    ) => {
      const timestamp = new Date().toISOString();
      const payload = serializeDiagram({
        projectId: nextProjectId,
        projectName: nextProjectName,
        projectDescription: nextProjectDescription,
        awsAccountId: nextAwsAccountId,
        nodes: nextNodes,
        edges: nextEdges,
        deploymentSettings: nextSettings,
        lastSavedAt: timestamp,
      });

      try {
        await updateProjectMutation.mutateAsync({
          projectId: nextProjectId,
          data: payload,
        });
        dispatch(setLastSavedAt(timestamp));

        originalProjectRef.current = {
          nodes: nextNodes,
          edges: nextEdges,
          deploymentSettings: nextSettings,
          projectName: nextProjectName,
          projectDescription: nextProjectDescription,
          awsAccountId: nextAwsAccountId,
        };

        if (!silent) {
          toast({
            title: 'Project saved',
            description:
              'The current architecture project has been saved to the server.',
          });
        }
      } catch (err) {
        console.error('Failed to save project:', err);
        if (!silent) {
          toast({
            title: 'Error saving project',
            description: 'Could not persist changes to the server.',
            variant: 'destructive',
          });
        }
      }
    },
    [dispatch, updateProjectMutation, originalProjectRef],
  );

  /* Autosave: debounced 1s after any diagram change. */
  React.useEffect(() => {
    const orig = originalProjectRef.current;
    if (
      isDiagramStructureEqual(nodes, orig.nodes, edges, orig.edges) &&
      deploymentSettings === orig.deploymentSettings &&
      projectName === orig.projectName &&
      projectDescription === orig.projectDescription &&
      awsAccountId === orig.awsAccountId
    ) {
      return;
    }

    const timer = setTimeout(() => {
      void persistDiagram(
        currentProjectId,
        projectName,
        projectDescription,
        awsAccountId,
        nodes,
        edges,
        deploymentSettings,
        true,
      );
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    nodes,
    edges,
    deploymentSettings,
    projectName,
    projectDescription,
    awsAccountId,
    currentProjectId,
    persistDiagram,
    originalProjectRef,
  ]);

  return { persistDiagram, isSaving: updateProjectMutation.isPending };
}
