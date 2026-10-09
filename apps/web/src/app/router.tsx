import { createBrowserRouter, Navigate } from 'react-router';
import App from '../App';
import { AuthScreen } from '../components/Auth/AuthScreen';
import { ProtectedRoute } from './ProtectedRoute';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/aquarium" replace />,
  },
  {
    path: '/login',
    element: <AuthScreen />,
  },
  {
    path: '/signup',
    element: <AuthScreen />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/aquarium',
        element: <App />,
      },
    ],
  },
]);