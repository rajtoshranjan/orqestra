import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type { PersistedDiagram } from '@/types';

import { api } from './client';
import {
  mapServerToClientProject,
  mapServerToClientProjectSummary,
  mapClientToServerProject,
} from './types';

import type {
  ServerResponse,
  ServerProject,
  ServerProjectSummary,
  ProjectSummary,
} from './types';

export const fetchProjects = async (): Promise<ProjectSummary[]> => {
  const response =
    await api.get<ServerResponse<ServerProjectSummary[]>>('/projects/');
  return response.data.data.map(mapServerToClientProjectSummary);
};

export const fetchProjectById = async (
  projectId: string,
): Promise<PersistedDiagram> => {
  const response = await api.get<ServerResponse<ServerProject>>(
    `/projects/${projectId}/`,
  );
  return mapServerToClientProject(response.data.data);
};

export const createProject = async (
  project: Partial<PersistedDiagram>,
): Promise<PersistedDiagram> => {
  const serverPayload = mapClientToServerProject(project);
  const response = await api.post<ServerResponse<ServerProject>>(
    '/projects/',
    serverPayload,
  );
  return mapServerToClientProject(response.data.data);
};

export const updateProject = async (
  projectId: string,
  project: Partial<PersistedDiagram>,
): Promise<PersistedDiagram> => {
  const serverPayload = mapClientToServerProject(project);
  const response = await api.put<ServerResponse<ServerProject>>(
    `/projects/${projectId}/`,
    serverPayload,
  );
  return mapServerToClientProject(response.data.data);
};

export const deleteProject = async (projectId: string): Promise<void> => {
  await api.delete(`/projects/${projectId}/`);
};

// React Query Hooks
export const useProjects = () => {
  return useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });
};

export const useProject = (projectId: string | null) => {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: () => fetchProjectById(projectId!),
    enabled: !!projectId,
  });
};

export const useCreateProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
};

export const useUpdateProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      data,
    }: {
      projectId: string;
      data: Partial<PersistedDiagram>;
    }) => updateProject(projectId, data),
    onSuccess: (data, variables) => {
      void qc.invalidateQueries({ queryKey: ['projects'] });
      qc.setQueryData(['project', variables.projectId], data);
    },
  });
};

export const useDeleteProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
};
