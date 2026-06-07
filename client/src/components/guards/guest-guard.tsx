import { Navigate, Outlet } from 'react-router-dom';
import { localStorageManager } from '../../lib/utils/local-storage-manager';

export function GuestGuard() {
  const isAuthenticated = localStorageManager.hasToken();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
