import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from './client';
import { snakeToCamelRecursive } from './types';

import type { ServerResponse } from './types';

/* Server types for deployment responses. */

export type ServerDeploymentLog = {
  level: string;
  message: string;
  timestamp: string;
};

export type ServerDeployment = {
  id: string;
  project: string;
  status:
    | 'pending'
    | 'generating'
    | 'invoking'
    | 'in_progress'
    | 'succeeded'
    | 'failed';
  logs: ServerDeploymentLog[];
  error_message: string;
  graph_snapshot?: any;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ServerDeployedResource = {
  id: string;
  node_id: string;
  service_id: string;
  resource_identifier: string;
  status: string;
  created_at: string;
};

export type ServerProjectDeploymentState = {
  id: string;
  project: string;
  last_deployment: ServerDeployment | null;
  deployed_graph_hash: string;
  last_deployed_at: string | null;
  resources: ServerDeployedResource[];
  created_at: string;
  updated_at: string;
};

/* Client types. */

export type DeploymentLog = {
  level: string;
  message: string;
  timestamp: string;
};

export type ClientDeployment = {
  id: string;
  projectId: string;
  status: ServerDeployment['status'];
  logs: DeploymentLog[];
  errorMessage: string;
  graphSnapshot?: any;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClientDeployedResource = {
  id: string;
  nodeId: string;
  serviceId: string;
  resourceIdentifier: string;
  status: string;
  createdAt: string;
};

export type ClientProjectDeploymentState = {
  id: string;
  projectId: string;
  lastDeployment: ClientDeployment | null;
  deployedGraphHash: string;
  lastDeployedAt: string | null;
  resources: ClientDeployedResource[];
  deployed: boolean;
};

/* Mappers. */

const mapServerDeployment = (server: ServerDeployment): ClientDeployment => ({
  id: server.id,
  projectId: server.project,
  status: server.status,
  logs: server.logs,
  errorMessage: server.error_message,
  graphSnapshot: snakeToCamelRecursive(server.graph_snapshot),
  startedAt: server.started_at,
  completedAt: server.completed_at,
  createdAt: server.created_at,
  updatedAt: server.updated_at,
});

const mapServerDeployedResource = (
  server: ServerDeployedResource,
): ClientDeployedResource => ({
  id: server.id,
  nodeId: server.node_id,
  serviceId: server.service_id,
  resourceIdentifier: server.resource_identifier,
  status: server.status,
  createdAt: server.created_at,
});

const mapServerDeploymentState = (
  server: ServerProjectDeploymentState,
): ClientProjectDeploymentState => ({
  id: server.id,
  projectId: server.project,
  lastDeployment: server.last_deployment
    ? mapServerDeployment(server.last_deployment)
    : null,
  deployedGraphHash: server.deployed_graph_hash,
  lastDeployedAt: server.last_deployed_at,
  resources: server.resources.map(mapServerDeployedResource),
  deployed: true,
});

/* API calls. */

export const createDeployment = async (
  projectId: string,
): Promise<ClientDeployment> => {
  const response = await api.post<ServerResponse<ServerDeployment>>(
    '/deployments/',
    { project_id: projectId },
  );
  return mapServerDeployment(response.data.data);
};

export const fetchDeployment = async (
  deploymentId: string,
): Promise<ClientDeployment> => {
  const response = await api.get<ServerResponse<ServerDeployment>>(
    `/deployments/${deploymentId}/`,
  );
  return mapServerDeployment(response.data.data);
};

export const fetchProjectDeploymentState = async (
  projectId: string,
): Promise<ClientProjectDeploymentState | null> => {
  const response = await api.get<ServerResponse<ServerProjectDeploymentState>>(
    `/deployments/project/${projectId}/state/`,
  );

  const data = response.data.data;

  // The endpoint returns {deployed: false} when no state exists.
  if (
    'deployed' in data &&
    (data as Record<string, unknown>).deployed === false
  ) {
    return null;
  }

  return mapServerDeploymentState(data);
};

/* React Query Hooks. */

export const useCreateDeployment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createDeployment,
    onSuccess: (_data, projectId) => {
      void queryClient.invalidateQueries({
        queryKey: ['project-deployment-state', projectId],
      });
    },
  });
};

export const useDeployment = (deploymentId: string | null) => {
  return useQuery({
    queryKey: ['deployment', deploymentId],
    queryFn: () => fetchDeployment(deploymentId!),
    enabled: !!deploymentId,
  });
};

export const useProjectDeploymentState = (projectId: string | null) => {
  return useQuery({
    queryKey: ['project-deployment-state', projectId],
    queryFn: () => fetchProjectDeploymentState(projectId!),
    enabled: !!projectId,
  });
};
