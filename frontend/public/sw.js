// Service worker minimalista para Restrepo Acosta — versión 3
// IMPORTANTE: el HTML SIEMPRE va a la red (network-only) para evitar
// que un index.html cacheado apunte a bundles JS viejos que ya no existen
// (Vite genera hashes nuevos en cada build).
const VERSION = 'ra-sistema-v3'

self.addEventListener('install', (event) => {
  // Skip waiting → activación inmediata
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // No interceptamos requests cross-origin, métodos no-GET, o APIs
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  // === HTML / navegación → NETWORK ONLY (nunca cachear) ===
  // Esto garantiza que después de un deploy, el usuario siempre recibe
  // el HTML nuevo que apunta a los hashes JS/CSS correctos.
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    return  // dejar pasar — el navegador hace fetch normal
  }

  // === Assets versionados (con hash en el nombre) → cache-first ===
  // Vite emite assets con hash inmortal — seguro cachear long-term
  if (/\/assets\/.+-[A-Za-z0-9]{8,}\.(js|css|woff2?|png|svg|jpg|webp)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached
        return fetch(event.request).then((res) => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(VERSION).then((c) => c.put(event.request, clone)).catch(() => {})
          }
          return res
        })
      })
    )
    return
  }

  // === Icons y favicon → cache-first ===
  if (/\/icons\/|\/favicon\.svg/.test(url.pathname)) {
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
  }
})
