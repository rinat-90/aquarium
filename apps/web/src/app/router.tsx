
import { createBrowserRouter, Navigate } from 'react-router';

import { AuthScreen } from '../components/Auth/AuthScreen';
import { AppLayout } from '../layout/AppLayout';

import { AquariumsPage } from '../pages/AquariumsPage/AquariumsPage';
import { AquariumPage } from '../pages/AquariumPage/AquariumPage';
import { TvAquariumPage } from '../pages/TvAquariumPage/TvAquariumPage';
import { TvPairPage } from '../pages/TvPairPage/TvPairPage';
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

  // Authentication.
  {
    path: '/login',
    element: <AuthScreen />,
  },
  {
    path: '/signup',
    element: <AuthScreen />,
  },

  // Public TV routes.
  // TVs don't need a Better Auth session.
  {
    path: '/tv',
    element: <TvAquariumPage />,
  },
  {
    path: '/tv/pair/:code',
    element: <TvPairPage />,
  },

  // Authenticated application routes.
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

      // Full-screen aquarium editor.
      {
        path: '/aquariums/:id',
        element: <AquariumPage />,
      },

      // Legacy authenticated TV route.
      // Keep temporarily for development/testing.
      {
        path: '/tv/:aquariumId',
        element: <TvAquariumPage />,
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
