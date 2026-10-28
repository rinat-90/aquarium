import { defineConfig, type ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';

const API_TARGET =
  process.env.API_PROXY_TARGET ?? 'http://localhost:3001';

export const createProxy = (): Record<string, string | ProxyOptions> => ({
  '/api': {
    target: API_TARGET,
    changeOrigin: true,
  },

  '/content': {
    target: API_TARGET,
    changeOrigin: true,
  },

  '/aquariums': {
    target: API_TARGET,
    changeOrigin: true,

    // Only proxy API requests, not browser page navigation.
    bypass(req) {
      const accept = req.headers.accept ?? '';

      if (accept.includes('text/html')) {
        return '/index.html';
      }
    },
  },

  // Match /fish and /fish/... but NOT /fish-templates/...
  '^/fish(?:/|$)': {
    target: API_TARGET,
    changeOrigin: true,

    // Let React Router handle browser page navigation.
    bypass(req) {
      const accept = req.headers.accept ?? '';

      if (accept.includes('text/html')) {
        return '/index.html';
      }
    },
  },

  '/socket.io': {
    target: API_TARGET,
    changeOrigin: true,
    ws: true,
  },
});

export default defineConfig({
  plugins: [react()],

  server: {
    host: '0.0.0.0',

    // Allow Cloudflare HTTPS tunnels.
    allowedHosts: ['.trycloudflare.com'],

    proxy: createProxy(),
  },

  preview: {
    allowedHosts: [
      'aquariumweb-production.up.railway.app',
      '.trycloudflare.com',
    ],

    proxy: createProxy(),
  },
});
