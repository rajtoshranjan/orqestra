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
};

export type OrganisationMemberInfo = {
  id: string;
  role: 'admin' | 'regular' | 'guest';
  userEmail: string;
  userName: string;
};

// APIs.
export const loginRequest = async (payload: Record<string, any>) => {
  const response = await api.post<ServerResponse<{ access: string; refresh: string }>>(
    '/accounts/login/',
    {
      username: payload.email,
      password: payload.password,
    }
  );
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
  const response = await api.patch<ServerResponse<UserInfo>>('/accounts/me/', payload);
  return response.data.data;
};

export const changePasswordRequest = async (payload: Record<string, any>) => {
  const response = await api.post<ServerResponse<void>>('/accounts/change-password/', {
    current_password: payload.currentPassword,
    new_password: payload.newPassword,
  });
  return response.data;
};

export const logoutRequest = async (refreshToken: string) => {
  const response = await api.post<ServerResponse<void>>('/accounts/logout/', {
    refresh_token: refreshToken,
  });
  return response.data;
};

// Organisations APIs.
export const fetchOrganisations = async (): Promise<OrganisationInfo[]> => {
  const response = await api.get<ServerResponse<OrganisationInfo[]>>('/organisations/');
  return response.data.data;
};

export const createOrganisation = async (payload: { name: string }): Promise<OrganisationInfo> => {
  const response = await api.post<ServerResponse<OrganisationInfo>>('/organisations/', payload);
  return response.data.data;
};

export const fetchOrganisationMembers = async (): Promise<OrganisationMemberInfo[]> => {
  const response = await api.get<ServerResponse<any[]>>('/organisations/members/');
  // Map snake_case response fields to camelCase
  return response.data.data.map((member) => ({
    id: member.id,
    role: member.role,
    userEmail: member.user_email,
    userName: member.user_name,
  }));
};

export const addOrganisationMember = async (payload: { email: string; role: string }): Promise<any> => {
  const response = await api.post<ServerResponse<any>>('/organisations/members/', payload);
  return response.data.data;
};

export const removeOrganisationMember = async (memberId: string): Promise<void> => {
  await api.delete(`/organisations/members/${memberId}/`);
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
