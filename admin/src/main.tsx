import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Show any uncaught JS error on screen so we can see it without DevTools
window.addEventListener('error', (e) => {
  document.body.innerHTML = `<pre style="color:red;background:#fff;padding:24px;font-size:14px;white-space:pre-wrap">${e.message}\n\n${e.filename}:${e.lineno}:${e.colno}\n\n${e.error?.stack ?? ''}</pre>`;
});
window.addEventListener('unhandledrejection', (e) => {
  document.body.innerHTML = `<pre style="color:red;background:#fff;padding:24px;font-size:14px;white-space:pre-wrap">Unhandled: ${String(e.reason)}\n\n${e.reason?.stack ?? ''}</pre>`;
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
