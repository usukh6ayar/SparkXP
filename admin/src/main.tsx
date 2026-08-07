import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Шинэ deploy гармагц бүх chunk-ийн hash солигдож, хуучин файлууд алга болно.
// Deploy-ээс өмнө нээлттэй байсан таб хуучин нэрийг санаж байдаг тул хуудас
// сольход lazy() import унана — Vercel-ийн SPA rewrite нь олдоогүй зам бүрд
// index.html буцаадаг учир браузер JS-ийн оронд HTML авч "Failed to fetch
// dynamically imported module" гэж хаядаг.
//
// Vite яг энэ тохиолдолд `vite:preloadError` гаргадаг. Нэг удаа reload хийвэл
// шинэ index.html + зөв chunk нэрсийг авна. `preventDefault()` нь алдааг
// цааш шидэхээс сэргийлж, доорх улаан дэлгэц гарахгүй болгоно.
const RELOAD_AT_KEY = 'chunk-reload-at';
window.addEventListener('vite:preloadError', (e) => {
  // Reload хийсний дараа route сэргээгдээд дахин унавал chunk нь үнэхээр
  // эвдэрсэн гэсэн үг — тэр үед reload давтахгүй, алдааг нь харуулна.
  // Хугацаагаар шалгаснаар дараагийн deploy дээр (өдрийн дараа ч) reload
  // дахин ажиллана; нэг удаагийн туг бол ажиллахаа болих байсан.
  const lastReload = Number(sessionStorage.getItem(RELOAD_AT_KEY) ?? 0);
  if (Date.now() - lastReload < 10_000) return;

  e.preventDefault();
  sessionStorage.setItem(RELOAD_AT_KEY, String(Date.now()));
  window.location.reload();
});

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
