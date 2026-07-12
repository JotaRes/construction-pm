import { useEffect } from 'react'

export type Theme = 'light'

// Modo oscuro ELIMINADO: el sistema opera SIEMPRE en modo claro.
// Este hook se conserva (neutralizado) para no romper los llamados existentes:
// fuerza data-theme="light" en <html>, limpia cualquier preferencia guardada y
// no permite alternar tema. `toggle` es un no-op e `isDark` siempre es false.
export function useTheme() {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light')
    try { localStorage.removeItem('ra-theme') } catch {}
    const metaTheme = document.querySelector('meta[name="theme-color"]')
    if (metaTheme) metaTheme.setAttribute('content', '#2D4B52')
  }, [])

  return { theme: 'light' as Theme, toggle: () => {}, isDark: false }
}
