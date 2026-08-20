import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { useForge } from './store';

if (import.meta.env.DEV) {
  // Debug handle for dev-tools poking; stripped from production builds.
  (window as unknown as { __forge: typeof useForge }).__forge = useForge;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
