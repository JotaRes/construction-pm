// Service worker simple para Restrepo Acosta Sistema
// - Caché del app shell para arranque rápido y modo offline limitado
// - Network-first para APIs (datos siempre frescos)
// - Cache-first para assets estáticos
const VERSION = 'ra-sistema-v1'
const APP_SHELL = ['/', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))
    ))
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // No interceptamos requests cross-origin, métodos no-GET, o auth
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return

  // APIs siempre van directo a la red — datos vivos
  if (url.pathname.startsWith('/api/')) return

  // Assets versionados (con hash en el nombre): cache-first
  if (/\.[a-f0-9]{8}\.(js|css|svg|png|woff2?)$/i.test(url.pathname) ||
      /\/assets\//i.test(url.pathname) ||
      /\/icons\//i.test(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cached) =>
        cached || fetch(event.request).then((res) => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(VERSION).then((c) => c.put(event.request, clone)).catch(() => {})
          }
          return res
        })
      )
    )
    return
  }

  // App shell (HTML): network-first, fallback al cache
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request).then((res) => {
        if (res.ok) {
          const clone = res.clone()
          caches.open(VERSION).then((c) => c.put('/', clone)).catch(() => {})
        }
        return res
      }).catch(() => caches.match('/').then((c) => c || new Response('Sin conexión', { status: 503 })))
    )
  }
})
