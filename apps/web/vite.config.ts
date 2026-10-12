import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_TARGET =
  process.env.API_PROXY_TARGET ??
  'http://localhost:3001';

export default defineConfig({
  plugins: [react()],

  server: {
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
      },
      '/socket.io': {
        target: API_TARGET,
        changeOrigin: true,
        ws: true,
      },
    },
  },

  preview: {
    allowedHosts: [
      'aquariumweb-production.up.railway.app',
    ],

    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
      },
      '/socket.io': {
        target: API_TARGET,
        changeOrigin: true,
        ws: true,
      },
    },
  },
});