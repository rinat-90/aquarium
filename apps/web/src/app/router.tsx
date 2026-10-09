
import { createBrowserRouter, Navigate } from 'react-router';
import App from '../App';
import { AuthScreen } from '../components/Auth/AuthScreen';
import { AquariumsPage } from '../pages/AquariumsPage/AquariumsPage';
import { ProtectedRoute } from './ProtectedRoute';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/aquariums" replace />,
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
        path: '/aquariums',
        element: <AquariumsPage />,
      },
      {
        path: '/aquariums/:id',
        element: <App />,
      },
      {
        path: '/aquarium',
        element: <Navigate to="/aquariums" replace />,
      },
    ],
  },
]);
