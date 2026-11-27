import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { applyTheme, cachedTheme } from './lib/theme';

applyTheme(cachedTheme());

// Ask the browser not to evict our data under storage pressure.
// Installed PWAs are usually granted this automatically.
if (navigator.storage?.persist) {
  navigator.storage.persisted().then((p) => {
    if (!p) navigator.storage.persist().catch(() => {});
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
