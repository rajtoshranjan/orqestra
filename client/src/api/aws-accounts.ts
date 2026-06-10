import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { ServerResponse } from './types';

type ServerAWSAccount = {
  id: string;
  name: string;
  access_key_id: string;
  endpoint_url?: string;
  created_at: string;
  updated_at: string;
};

type ServerCreateAWSAccountPayload = {
  name: string;
  access_key_id: string;
  secret_access_key: string;
  endpoint_url?: string;
};

export type AWSAccount = {
  id: string;
  name: string;
  accessKeyId: string;
  endpointUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateAWSAccountPayload = {
  name: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpointUrl?: string;
};

export type UpdateAWSAccountPayload = Partial<CreateAWSAccountPayload>;

const mapServerAWSAccountToClient = (server: ServerAWSAccount): AWSAccount => ({
  id: server.id,
  name: server.name,
  accessKeyId: server.access_key_id,
  endpointUrl: server.endpoint_url,
  createdAt: server.created_at,
  updatedAt: server.updated_at,
});

const mapCreatePayloadToServer = (
  payload: CreateAWSAccountPayload,
): ServerCreateAWSAccountPayload => ({
  name: payload.name,
  access_key_id: payload.accessKeyId,
  secret_access_key: payload.secretAccessKey,
  endpoint_url: payload.endpointUrl,
});

const mapUpdatePayloadToServer = (
  payload: UpdateAWSAccountPayload,
): Partial<ServerCreateAWSAccountPayload> => {
  const server: Partial<ServerCreateAWSAccountPayload> = {};
  if (payload.name !== undefined) server.name = payload.name;
  if (payload.accessKeyId !== undefined)
    server.access_key_id = payload.accessKeyId;
  if (payload.secretAccessKey !== undefined)
    server.secret_access_key = payload.secretAccessKey;
  if (payload.endpointUrl !== undefined)
    server.endpoint_url = payload.endpointUrl;
  return server;
};

const fetchAWSAccounts = async (): Promise<AWSAccount[]> => {
  const response = await api.get<ServerResponse<ServerAWSAccount[]>>(
    '/organisations/aws-accounts/',
  );
  return response.data.data.map(mapServerAWSAccountToClient);
};

const createAWSAccount = async (
  payload: CreateAWSAccountPayload,
): Promise<AWSAccount> => {
  const response = await api.post<ServerResponse<ServerAWSAccount>>(
    '/organisations/aws-accounts/',
    mapCreatePayloadToServer(payload),
  );
  return mapServerAWSAccountToClient(response.data.data);
};

const updateAWSAccount = async (
  accountId: string,
  payload: UpdateAWSAccountPayload,
): Promise<AWSAccount> => {
  const response = await api.patch<ServerResponse<ServerAWSAccount>>(
    `/organisations/aws-accounts/${accountId}/`,
    mapUpdatePayloadToServer(payload),
  );
  return mapServerAWSAccountToClient(response.data.data);
};

const deleteAWSAccount = async (accountId: string): Promise<void> => {
  await api.delete(`/organisations/aws-accounts/${accountId}/`);
};

export const useAWSAccounts = () => {
  return useQuery({
    queryKey: ['aws-accounts'],
    queryFn: fetchAWSAccounts,
  });
};

export const useCreateAWSAccount = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAWSAccount,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['aws-accounts'] });
    },
  });
};

export const useUpdateAWSAccount = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      accountId,
      data,
    }: {
      accountId: string;
      data: UpdateAWSAccountPayload;
    }) => updateAWSAccount(accountId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['aws-accounts'] });
    },
  });
};

export const useDeleteAWSAccount = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAWSAccount,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['aws-accounts'] });
    },
  });
};
