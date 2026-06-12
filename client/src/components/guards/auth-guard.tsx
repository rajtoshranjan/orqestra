import { Navigate, Outlet } from 'react-router-dom';

import { localStorageManager } from '../../lib/utils/local-storage-manager';

export function AuthGuard() {
  const isAuthenticated = localStorageManager.hasToken();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
