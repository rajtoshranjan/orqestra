import type { PersistedDiagram } from '@/types';

export type ServerResponse<T> = {
  data: T;
  meta: {
    success: boolean;
    status_code: number;
    message: string;
    type: 'success' | 'error';
  };
  errors?: any;
};

export type ServerProject = {
  id: string;
  name: string;
  description: string;
  nodes: any[];
  edges: any[];
  deployment_settings: any;
  aws_account: string | null;
  created_at: string;
  updated_at: string;
};

export type ServerProjectSummary = {
  id: string;
  name: string;
  description: string;
  aws_account: string | null;
  node_count: number;
  created_at: string;
  updated_at: string;
};

export type ProjectSummary = {
  projectId: string;
  projectName: string;
  projectDescription: string;
  awsAccountId: string | null;
  nodeCount: number;
  lastSavedAt: string;
};

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

export function mapServerToClientProject(
  server: ServerProject,
): PersistedDiagram {
  return {
    projectId: server.id,
    projectName: server.name,
    projectDescription: server.description,
    awsAccountId: server.aws_account || null,
    nodes: snakeToCamelRecursive(server.nodes) || [],
    edges: snakeToCamelRecursive(server.edges) || [],
    deploymentSettings: snakeToCamelRecursive(server.deployment_settings) || {},
    lastSavedAt: server.updated_at,
  };
}

export function mapServerToClientProjectSummary(
  server: ServerProjectSummary,
): ProjectSummary {
  return {
    projectId: server.id,
    projectName: server.name,
    projectDescription: server.description,
    awsAccountId: server.aws_account || null,
    nodeCount: server.node_count,
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
  if (client.awsAccountId !== undefined)
    server.aws_account = client.awsAccountId;
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
