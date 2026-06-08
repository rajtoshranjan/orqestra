import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { ServerResponse } from './types';

// Types.
export type UserInfo = {
  id: string;
  email: string;
  name: string;
};

export type OrganisationInfo = {
  id: string;
  name: string;
  role: 'owner' | 'admin' | 'regular' | 'guest';
  ownerEmail?: string;
  ownerName?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type OrganisationMemberInfo = {
  id: string;
  role: 'admin' | 'regular' | 'guest';
  userEmail: string;
  userName: string;
};

// APIs.
export const loginRequest = async (payload: Record<string, any>) => {
  const response = await api.post<
    ServerResponse<{ access: string; refresh: string }>
  >('/accounts/login/', {
    username: payload.email,
    password: payload.password,
  });
  return response.data;
};

export const signupRequest = async (payload: Record<string, any>) => {
  const response = await api.post<ServerResponse<UserInfo>>('/accounts/', {
    email: payload.email,
    password: payload.password,
    name: payload.name,
  });
  return response.data;
};

export const getUserInfoRequest = async () => {
  const response = await api.get<ServerResponse<UserInfo>>('/accounts/me/');
  return response.data.data;
};

export const updateProfileRequest = async (payload: { name: string }) => {
  const response = await api.patch<ServerResponse<UserInfo>>(
    '/accounts/me/',
    payload,
  );
  return response.data.data;
};

export const changePasswordRequest = async (payload: Record<string, any>) => {
  const response = await api.post<ServerResponse<void>>(
    '/accounts/change-password/',
    {
      current_password: payload.currentPassword,
      new_password: payload.newPassword,
    },
  );
  return response.data;
};

export const logoutRequest = async (refreshToken: string) => {
  const response = await api.post<ServerResponse<void>>('/accounts/logout/', {
    refresh_token: refreshToken,
  });
  return response.data;
};

// Mapper for backend to frontend Organisation properties.
const mapServerOrganisation = (org: any): OrganisationInfo => ({
  id: org.id,
  name: org.name,
  role: org.role,
  ownerEmail: org.owner_email,
  ownerName: org.owner_name,
  createdAt: org.created_at,
  updatedAt: org.updated_at,
});

// Organisations APIs.
export const fetchOrganisations = async (): Promise<OrganisationInfo[]> => {
  const response = await api.get<ServerResponse<any[]>>('/organisations/');
  return response.data.data.map(mapServerOrganisation);
};

export const createOrganisation = async (payload: {
  name: string;
}): Promise<OrganisationInfo> => {
  const response = await api.post<ServerResponse<any>>(
    '/organisations/',
    payload,
  );
  return mapServerOrganisation(response.data.data);
};

export const updateOrganisation = async (payload: {
  organisationId: string;
  name: string;
}): Promise<OrganisationInfo> => {
  const response = await api.patch<ServerResponse<any>>(
    `/organisations/${payload.organisationId}/`,
    { name: payload.name },
  );
  return mapServerOrganisation(response.data.data);
};

export const deleteOrganisation = async (
  organisationId: string,
): Promise<void> => {
  await api.delete(`/organisations/${organisationId}/`);
};

export const fetchOrganisationMembers = async (): Promise<
  OrganisationMemberInfo[]
> => {
  const response = await api.get<ServerResponse<any[]>>(
    '/organisations/members/',
  );
  // Map snake_case response fields to camelCase
  return response.data.data.map((member) => ({
    id: member.id,
    role: member.role,
    userEmail: member.user_email,
    userName: member.user_name,
  }));
};

export const addOrganisationMember = async (payload: {
  email: string;
  role: string;
}): Promise<any> => {
  const response = await api.post<ServerResponse<any>>(
    '/organisations/members/',
    payload,
  );
  return response.data.data;
};

export const removeOrganisationMember = async (
  memberId: string,
): Promise<void> => {
  await api.delete(`/organisations/members/${memberId}/`);
};

export const updateOrganisationMember = async (payload: {
  memberId: string;
  role: string;
}): Promise<any> => {
  const response = await api.patch<ServerResponse<any>>(
    `/organisations/members/${payload.memberId}/`,
    { role: payload.role },
  );
  return response.data.data;
};

export interface AuditLogEntry {
  id: string;
  action: string;
  details: Record<string, any>;
  actorEmail: string | null;
  actorName: string | null;
  createdAt: string;
}

export const fetchAuditLogs = async (): Promise<AuditLogEntry[]> => {
  const response = await api.get<ServerResponse<any[]>>(
    '/organisations/audit-logs/',
  );
  return response.data.data.map((log) => ({
    id: log.id,
    action: log.action,
    details: log.details,
    actorEmail: log.actor_email,
    actorName: log.actor_name,
    createdAt: log.created_at,
  }));
};

// React Query Hooks.
export const useLogin = () =>
  useMutation({
    mutationFn: loginRequest,
  });

export const useSignup = () =>
  useMutation({
    mutationFn: signupRequest,
  });

export const useGetUserInfo = (enabled = true) =>
  useQuery({
    queryKey: ['userInfo'],
    queryFn: getUserInfoRequest,
    enabled,
  });

export const useUpdateProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateProfileRequest,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['userInfo'] });
    },
  });
};

export const useChangePassword = () =>
  useMutation({
    mutationFn: changePasswordRequest,
  });

export const useLogout = () =>
  useMutation({
    mutationFn: logoutRequest,
  });

export const useOrganisations = (enabled = true) =>
  useQuery({
    queryKey: ['organisations'],
    queryFn: fetchOrganisations,
    enabled,
  });

export const useCreateOrganisation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createOrganisation,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['organisations'] });
    },
  });
};

export const useUpdateOrganisation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateOrganisation,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['organisations'] });
    },
  });
};

export const useDeleteOrganisation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteOrganisation,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['organisations'] });
    },
  });
};

export const useOrganisationMembers = (enabled = true) =>
  useQuery({
    queryKey: ['organisationMembers'],
    queryFn: fetchOrganisationMembers,
    enabled,
  });

export const useAddOrganisationMember = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: addOrganisationMember,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['organisationMembers'] });
    },
  });
};

export const useRemoveOrganisationMember = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: removeOrganisationMember,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['organisationMembers'] });
    },
  });
};

export const useUpdateOrganisationMember = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateOrganisationMember,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['organisationMembers'] });
    },
  });
};

export const useAuditLogs = (enabled = true) =>
  useQuery({
    queryKey: ['auditLogs'],
    queryFn: fetchAuditLogs,
    enabled,
  });
