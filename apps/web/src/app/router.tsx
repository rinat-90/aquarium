
import { createBrowserRouter, Navigate } from 'react-router';

import { AuthScreen } from '../components/Auth/AuthScreen';
import { AppLayout } from '../layout/AppLayout';

import { AquariumsPage } from '../pages/AquariumsPage/AquariumsPage';
import { AquariumPage } from '../pages/AquariumPage/AquariumPage';
import { CreateFishPage } from '../pages/CreateFishPage/CreateFishPage';
import { DrawFishPage } from '../pages/DrawFishPage/DrawFishPage';
import { CustomizeFishPage } from '../pages/CustomizeFishPage/CustomizeFishPage';
import { ProfilePage } from '../pages/ProfilePage/ProfilePage';

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
      // Dashboard pages share the main sidebar.
      {
        element: <AppLayout />,
        children: [
          {
            path: '/aquariums',
            element: <AquariumsPage />,
          },
          {
            path: '/fish/create',
            element: <CreateFishPage />,
          },
          {
            path: '/profile',
            element: <ProfilePage />,
          },
        ],
      },

      // Full-screen aquarium experience.
      {
        path: '/aquariums/:id',
        element: <AquariumPage />,
      },

      // Full-screen fish creation editors.
      {
        path: '/fish/create/draw',
        element: <DrawFishPage />,
      },
      {
        path: '/fish/create/3d',
        element: <CustomizeFishPage />,
      },

      // Legacy route.
      {
        path: '/aquarium',
        element: <Navigate to="/aquariums" replace />,
      },
    ],
  },
]);
