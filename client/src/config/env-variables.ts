export const EnvVariables = {
  apiUrl: import.meta.env.VITE_API_URL?.toString() || 'http://localhost:3001',
} as const;
