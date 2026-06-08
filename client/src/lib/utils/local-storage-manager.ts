export const localStorageManager = {
  // Auth.
  getToken: () => {
    return localStorage.getItem('token');
  },
  setToken: (token: string) => {
    localStorage.setItem('token', token);
  },
  removeToken: () => {
    localStorage.removeItem('token');
  },
  setRefreshToken: (token: string) => {
    localStorage.setItem('refreshToken', token);
  },
  getRefreshToken: () => {
    return localStorage.getItem('refreshToken');
  },
  removeRefreshToken: () => {
    localStorage.removeItem('refreshToken');
  },
  hasToken: () => {
    return !!localStorage.getItem('token');
  },

  // Active Organisation.
  getActiveOrgId: () => {
    const raw = localStorage.getItem('activeOrgId');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  },
  setActiveOrgId: (id: string) => {
    localStorage.setItem('activeOrgId', JSON.stringify(id));
  },
  removeActiveOrgId: () => {
    localStorage.removeItem('activeOrgId');
  },

  // Theme.
  getTheme: () => {
    return localStorage.getItem('theme');
  },
  setTheme: (theme: string) => {
    localStorage.setItem('theme', theme);
  },
};
