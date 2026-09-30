import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { boot } from './store/store';
import './styles/tokens.css';
import './styles/app.css';

let prefersDark = false;
try {
  prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
} catch {
  /* older browsers: stay light */
}
boot(prefersDark);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
