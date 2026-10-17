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

// The TV display is intentionally excluded from the PWA lifecycle.
if (
  import.meta.env.PROD &&
  'serviceWorker' in navigator &&
  !/webOS|Web0S/i.test(navigator.userAgent)
) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        let acceptingUpdate = false;
        let prompt: HTMLDivElement | null = null;

        const showUpdate = () => {
          if (!registration.waiting || !navigator.serviceWorker.controller || prompt) return;

          prompt = document.createElement('div');
          prompt.setAttribute('role', 'status');
          prompt.style.cssText =
            'position:fixed;bottom:calc(16px + env(safe-area-inset-bottom, 0px));left:16px;right:16px;z-index:2147483647;max-width:420px;margin:auto;padding:14px 16px;border-radius:16px;background:#102d45;color:white;box-shadow:0 8px 30px #0006;display:flex;align-items:center;gap:12px;font:14px system-ui,sans-serif';
          const label = document.createElement('span');
          label.textContent = 'A new Finny version is ready.';
          label.style.flex = '1';
          const later = document.createElement('button');
          later.textContent = 'Later';
          const update = document.createElement('button');
          update.textContent = 'Update';
          for (const button of [later, update]) {
            button.style.cssText =
              'border:0;border-radius:10px;padding:10px 12px;cursor:pointer;font:inherit';
          }
          update.style.background = '#73e0d0';
          update.style.color = '#092735';
          later.style.background = '#284b62';
          later.style.color = '#fff';
          later.addEventListener('click', () => {
            prompt?.remove();
            prompt = null;
          });
          update.addEventListener('click', () => {
            if (!registration.waiting) return;
            acceptingUpdate = true;
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          });
          prompt.append(label, later, update);
          document.body.append(prompt);
        };

        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (acceptingUpdate) window.location.reload();
        });
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          installing?.addEventListener('statechange', () => {
            if (installing.state === 'installed') showUpdate();
          });
        });
        showUpdate();

        const checkForUpdates = () => {
          if (navigator.onLine) void registration.update().catch(() => undefined);
        };
        const onVisible = () => {
          if (document.visibilityState === 'visible') checkForUpdates();
        };
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('online', checkForUpdates);
        window.setInterval(checkForUpdates, 60 * 60 * 1000);
      })
      .catch((error: unknown) => {
        console.warn('Finny service worker registration failed:', error);
      });
  });
}
