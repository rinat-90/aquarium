
import { createBrowserRouter, Navigate } from 'react-router';

import { AuthScreen } from '../components/Auth/AuthScreen';
import { AquariumsPage } from '../pages/AquariumsPage/AquariumsPage';
import { AquariumPage } from '../pages/AquariumPage/AquariumPage';
import { CreateFishPage } from '../pages/CreateFishPage/CreateFishPage';
import { DrawFishPage } from '../pages/DrawFishPage/DrawFishPage';
import { CustomizeFishPage } from '../pages/CustomizeFishPage/CustomizeFishPage';

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
        element: <AquariumPage />,
      },
      {
        path: '/fish/create',
        element: <CreateFishPage />,
      },
      {
        path: '/fish/create/draw',
        element: <DrawFishPage />,
      },
      {
        path: '/fish/create/3d',
        element: <CustomizeFishPage />,
      },
      {
        path: '/aquarium',
        element: <Navigate to="/aquariums" replace />,
      },
    ],
  },
]);
