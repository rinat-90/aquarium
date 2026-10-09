import { Navigate, Outlet } from 'react-router';
import { authClient } from '../lib/auth-client';

export function ProtectedRoute() {
  const { data: session, isPending, error } = authClient.useSession();

  if (isPending) {
    return <div>Loading aquarium...</div>;
  }

  if (error) {
    return <div>Unable to check your session. Please try again.</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}