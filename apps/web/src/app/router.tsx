import { lazy, Suspense, type ReactNode } from 'react';

import { createBrowserRouter, Navigate } from 'react-router';

const AuthScreen = lazy(() => import('../components/Auth/AuthScreen').then((module) => ({ default: module.AuthScreen })));
import { AppLayout } from '../layout/AppLayout';

const AquariumsPage = lazy(() => import('../pages/AquariumsPage/AquariumsPage').then((module) => ({ default: module.AquariumsPage })));
const AquariumPage = lazy(() => import('../pages/AquariumPage/AquariumPage').then((module) => ({ default: module.AquariumPage })));
const EditAquariumPage = lazy(() => import('../pages/EditAquariumPage/EditAquariumPage').then((module) => ({ default: module.EditAquariumPage })));
const TvAquariumPage = lazy(() => import('../pages/TvAquariumPage/TvAquariumPage').then((module) => ({ default: module.TvAquariumPage })));
const TvPairPage = lazy(() => import('../pages/TvPairPage/TvPairPage').then((module) => ({ default: module.TvPairPage })));
const CreateFishPage = lazy(() => import('../pages/CreateFishPage/CreateFishPage').then((module) => ({ default: module.CreateFishPage })));
const ScanFishPage = lazy(() => import('../pages/ScanFishPage/ScanFishPage').then((module) => ({ default: module.ScanFishPage })));
const DrawFishPage = lazy(() => import('../pages/DrawFishPage/DrawFishPage').then((module) => ({ default: module.DrawFishPage })));
const CustomizeFishPage = lazy(() => import('../pages/CustomizeFishPage/CustomizeFishPage').then((module) => ({ default: module.CustomizeFishPage })));
const ProfilePage = lazy(() => import('../pages/ProfilePage/ProfilePage').then((module) => ({ default: module.ProfilePage })));
const TvManagerPage = lazy(() => import('../pages/TvManagerPage/TvManagerPage').then((module) => ({ default: module.TvManagerPage })));

import { ProtectedRoute } from './ProtectedRoute';

// A page-specific boundary keeps a failed or slow chunk from blanking the app.
function lazyPage(page: ReactNode) {
  return (
    <Suspense fallback={<div role="status" style={{ padding: '2rem', color: '#d9f3ff' }}>Loading…</div>}>
      {page}
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/aquariums" replace />,
  },

  // Authentication.
  {
    path: '/login',
    element: lazyPage(<AuthScreen />),
  },
  {
    path: '/signup',
    element: lazyPage(<AuthScreen />),
  },

  // Public TV routes.
  // TVs don't need a Better Auth session.
  {
    path: '/tv',
    element: lazyPage(<TvAquariumPage />),
  },
  {
    path: '/tv/pair/:code',
    element: lazyPage(<TvPairPage />),
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
            element: lazyPage(<AquariumsPage />),
          },
          {
            path: '/fish/create',
            element: lazyPage(<CreateFishPage />),
          },
          {
            path: '/tv/manage',
            element: lazyPage(<TvManagerPage />),
          },
          {
            path: '/profile',
            element: lazyPage(<ProfilePage />),
          },
        ],
      },

      // Standalone aquarium management workspace (no AppLayout sidebar).
      {
        path: '/aquariums/edit/:id',
        element: lazyPage(<EditAquariumPage />),
      },

      // Full-screen aquarium editor.
      {
        path: '/aquariums/:id',
        element: lazyPage(<AquariumPage />),
      },

      // Legacy authenticated TV route.
      // Keep temporarily for development/testing.
      {
        path: '/tv/:aquariumId',
        element: lazyPage(<TvAquariumPage />),
      },

      // Full-screen fish creation editors.
      {
        path: '/fish/create/draw',
        element: lazyPage(<DrawFishPage />),
      },
      {
        path: '/fish/create/scan',
        element: lazyPage(<ScanFishPage />),
      },
      {
        path: '/fish/create/3d',
        element: lazyPage(<CustomizeFishPage />),
      },

      // Legacy route.
      {
        path: '/aquarium',
        element: <Navigate to="/aquariums" replace />,
      },
    ],
  },
]);
