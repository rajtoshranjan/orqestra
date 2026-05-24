import {
  QueryClient,
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import axios from 'axios';
import { EnvVariables } from '@/config';
import type { PersistedDiagram } from '@/types';

// Create Axios Instance
export const api = axios.create({
  baseURL: EnvVariables.apiUrl,
});

// Response Types
export interface ServerResponse<T> {
  data: T;
  meta: {
    success: boolean;
    status_code: number;
    message: string;
    type: 'success' | 'error';
  };
  errors?: any;
}

// Server Schema interface
export interface ServerProject {
  id: string;
  name: string;
  description: string;
  nodes: any[];
  edges: any[];
  deployment_settings: any;
  created_at: string;
  updated_at: string;
}

export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function toCamelCase(str: string): string {
  return str.replace(/([-_][a-z])/g, (group) =>
    group.toUpperCase().replace('-', '').replace('_', ''),
  );
}

export function camelToSnakeRecursive(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(camelToSnakeRecursive);
  }
  if (obj !== null && typeof obj === 'object') {
    const newObj: any = {};
    for (const key of Object.keys(obj)) {
      newObj[toSnakeCase(key)] = camelToSnakeRecursive(obj[key]);
    }
    return newObj;
  }
  return obj;
}

export function snakeToCamelRecursive(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(snakeToCamelRecursive);
  }
  if (obj !== null && typeof obj === 'object') {
    const newObj: any = {};
    for (const key of Object.keys(obj)) {
      newObj[toCamelCase(key)] = snakeToCamelRecursive(obj[key]);
    }
    return newObj;
  }
  return obj;
}

// Explicit mappings to keep server 100% snake_case and client camelCase
export function mapServerToClientProject(
  server: ServerProject,
): PersistedDiagram {
  return {
    projectId: server.id,
    projectName: server.name,
    projectDescription: server.description,
    nodes: snakeToCamelRecursive(server.nodes) || [],
    edges: snakeToCamelRecursive(server.edges) || [],
    deploymentSettings: snakeToCamelRecursive(server.deployment_settings) || {},
    lastSavedAt: server.updated_at,
  };
}

export function mapClientToServerProject(
  client: Partial<PersistedDiagram>,
): Partial<ServerProject> {
  const server: Partial<ServerProject> = {};
  if (client.projectId !== undefined) server.id = client.projectId;
  if (client.projectName !== undefined) server.name = client.projectName;
  if (client.projectDescription !== undefined)
    server.description = client.projectDescription;
  if (client.nodes !== undefined)
    server.nodes = camelToSnakeRecursive(client.nodes);
  if (client.edges !== undefined)
    server.edges = camelToSnakeRecursive(client.edges);
  if (client.deploymentSettings !== undefined)
    server.deployment_settings = camelToSnakeRecursive(
      client.deploymentSettings,
    );
  return server;
}

// Fetch helper functions
export const fetchProjects = async (): Promise<PersistedDiagram[]> => {
  const response =
    await api.get<ServerResponse<ServerProject[]>>('/api/projects/');
  return response.data.data.map(mapServerToClientProject);
};

/**
 * Fetch project using request query parameters (as requested by user)
 */
export const fetchProjectByQuery = async (
  projectId: string,
): Promise<PersistedDiagram | null> => {
  const response = await api.get<ServerResponse<ServerProject[]>>(
    '/api/projects/',
    {
      params: { project_id: projectId }, // snake_case query param
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

// React Query Client
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5000,
    },
  },
});

// Custom hooks for TanStack Query
export const useProjects = () => {
  return useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });
};

export const useProject = (projectId: string | null) => {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: () => fetchProjectByQuery(projectId!), // Uses request query parameters!
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
