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