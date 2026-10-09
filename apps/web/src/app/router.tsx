import { createBrowserRouter, Navigate } from 'react-router';

import { AuthScreen } from '../components/Auth/AuthScreen';
import { AquariumsPage } from '../pages/AquariumsPage/AquariumsPage';
import { AquariumPage } from '../pages/AquariumPage/AquariumPage';
import { CreateFishPage } from '../pages/CreateFishPage/CreateFishPage';
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
    path: '/fish/create',
    element: <CreateFishPage />,
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
        element: <AquariumPage />,
      },
      {
        path: '/aquarium',
        element: <Navigate to="/aquariums" replace />,
      },
    ],
  },
]);