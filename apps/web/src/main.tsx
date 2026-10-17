import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/family-ocean.css';

import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Keep the LG webOS TV browser out of the PWA service-worker lifecycle.
if (
  import.meta.env.PROD &&
  'serviceWorker' in navigator &&
  !/webOS|Web0S/i.test(navigator.userAgent)
) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      console.warn('Finny offline page registration failed:', error);
    });
  });
}
