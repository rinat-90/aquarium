
import { createBrowserRouter, Navigate } from 'react-router';

import { AuthScreen } from '../components/Auth/AuthScreen';
import { AppLayout } from '../layout/AppLayout';

import { AquariumsPage } from '../pages/AquariumsPage/AquariumsPage';
import { AquariumPage } from '../pages/AquariumPage/AquariumPage';
import { EditAquariumPage } from '../pages/EditAquariumPage/EditAquariumPage';
import { TvAquariumPage } from '../pages/TvAquariumPage/TvAquariumPage';
import { TvPairPage } from '../pages/TvPairPage/TvPairPage';
import { CreateFishPage } from '../pages/CreateFishPage/CreateFishPage';
import { ScanFishPage } from '../pages/ScanFishPage/ScanFishPage';
import { DrawFishPage } from '../pages/DrawFishPage/DrawFishPage';
import { CustomizeFishPage } from '../pages/CustomizeFishPage/CustomizeFishPage';
import { ProfilePage } from '../pages/ProfilePage/ProfilePage';
import { TvManagerPage } from '../pages/TvManagerPage/TvManagerPage';

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
      // Dashboard pages share the main sidebar
      // and mobile bottom navigation.
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
            path: '/tv/manage',
            element: <TvManagerPage />,
          },
          {
            path: '/profile',
            element: <ProfilePage />,
          },
        ],
      },

      // Standalone aquarium management workspace (no AppLayout sidebar).
      {
        path: '/aquariums/edit/:id',
        element: <EditAquariumPage />,
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
        path: '/fish/create/scan',
        element: <ScanFishPage />,
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
