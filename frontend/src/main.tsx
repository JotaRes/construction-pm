import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'

// === Ocultar el splash de carga ===
// IMPORTANTE: esto debe estar en el bundle JS (no en script inline del HTML),
// porque el CSP del backend tiene `script-src 'self'` sin 'unsafe-inline',
// lo que bloquea cualquier <script> inline. Antes el splash quedaba bloqueado
// porque el script inline que lo ocultaba nunca ejecutaba (CSP).
function hideSplash() {
  const splash = document.getElementById('app-loading')
  if (splash) {
    splash.classList.add('hidden')
    setTimeout(() => splash.parentNode && splash.parentNode.removeChild(splash), 400)
  }
}

// === Limpieza preventiva de caches viejos del Service Worker ===
// Si el usuario tenía un SW v1/v2 con HTML obsoleto cacheado, lo borramos.
if (typeof window !== 'undefined' && 'caches' in window) {
  caches.keys().then((keys) => {
    keys.forEach((k) => {
      if (k.indexOf('ra-sistema-v3') === -1) caches.delete(k).catch(() => {})
    })
  }).catch(() => {})
}

// === Registrar Service Worker (solo HTTPS producción) ===
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      reg.update().catch(() => {})
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing
        if (nw) nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            if ('caches' in window) {
              caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)))
            }
          }
        })
      })
    }).catch((err) => console.warn('SW registration failed:', err))
  })
}

// === Montar React ===
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30000, retry: 1 } },
})

const rootEl = document.getElementById('root')!
ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
)

// Ocultar el splash apenas React montó el primer nodo
// requestAnimationFrame asegura que el primer paint ya ocurrió
requestAnimationFrame(() => requestAnimationFrame(hideSplash))

// Fallback absoluto: si algo sale mal, ocultar splash a los 3 segundos
setTimeout(hideSplash, 3000)
