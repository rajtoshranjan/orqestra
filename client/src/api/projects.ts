import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import {
  mapServerToClientProject,
  mapClientToServerProject,
} from './types';
import type { ServerResponse, ServerProject } from './types';
import type { PersistedDiagram } from '@/types';

export const fetchProjects = async (): Promise<PersistedDiagram[]> => {
  const response =
    await api.get<ServerResponse<ServerProject[]>>('/api/projects/');
  return response.data.data.map(mapServerToClientProject);
};

export const fetchProjectByQuery = async (
  projectId: string,
): Promise<PersistedDiagram | null> => {
  const response = await api.get<ServerResponse<ServerProject[]>>(
    '/api/projects/',
    {
      params: { project_id: projectId },
    },
  );
  const list = response.data.data;
  return list.length > 0 ? mapServerToClientProject(list[0]) : null;
};

export const fetchProjectById = async (
  projectId: string,
): Promise<PersistedDiagram> => {
  const response = await api.get<ServerResponse<ServerProject>>(
    `/api/projects/${projectId}/`,
  );
  return mapServerToClientProject(response.data.data);
};

export const createProject = async (
  project: Partial<PersistedDiagram>,
): Promise<PersistedDiagram> => {
  const serverPayload = mapClientToServerProject(project);
  const response = await api.post<ServerResponse<ServerProject>>(
    '/api/projects/',
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
    `/api/projects/${projectId}/`,
    serverPayload,
  );
  return mapServerToClientProject(response.data.data);
};

export const deleteProject = async (projectId: string): Promise<void> => {
  await api.delete(`/api/projects/${projectId}/`);
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
    queryFn: () => fetchProjectByQuery(projectId!),
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
