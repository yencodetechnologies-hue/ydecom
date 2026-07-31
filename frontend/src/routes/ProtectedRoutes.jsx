import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAppSelector } from '../app/hooks';

export function PrivateRoute() {
  const { token, user } = useAppSelector((s) => s.auth);
  const location = useLocation();
  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}

export function RoleRoute({ roles = [] }) {
  const { user } = useAppSelector((s) => s.auth);
  if (!roles.includes(user?.role)) {
    return <Navigate to={user?.role === 'customer' ? '/' : '/dashboard'} replace />;
  }
  return <Outlet />;
}

export function GuestRoute() {
  const { token, user } = useAppSelector((s) => s.auth);
  if (token && user) {
    return <Navigate to={user.role === 'customer' ? '/' : '/dashboard'} replace />;
  }
  return <Outlet />;
}
