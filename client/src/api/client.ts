import { QueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { EnvVariables } from '@/config';

export const api = axios.create({
  baseURL: EnvVariables.apiUrl,
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5000,
    },
  },
});
