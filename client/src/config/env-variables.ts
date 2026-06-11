export const EnvVariables = {
  apiUrl: import.meta.env.VITE_API_URL?.toString() ?? 'http://localhost:3001',
  get wsUrl() {
    const url = new URL(this.apiUrl);
    const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${url.host}/ws/`;
  },
} as const;
