import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  preview: {
    allowedHosts: [
      'aquariumweb-production.up.railway.app',
    ],
  },
});