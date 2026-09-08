/**
 * NÚCLEO i18n — Sistema Restrepo Acosta Global Holding LLC
 * ─────────────────────────────────────────────────────────────────────────────
 * Implementación propia, sin dependencias externas. Motivo: react-i18next pesa
 * ~40 KB gzip y trae carga async de recursos que no necesitamos — el sistema
 * tiene dos idiomas fijos y el diccionario cabe en el bundle. Menos superficie,
 * cero configuración, y tipado estricto de claves que una librería genérica no
 * puede darnos.
 *
 * USO:
 *   const { t, tc, lang, setLang, locale } = useI18n()
 *   t('common.logout')                                → "Cerrar sesión"
 *   t('gate.enter', { module: 'Módulo Técnico' })      → interpolación
 *   tc('home.projectCount', 3)                         → plural correcto
 *   new Date().toLocaleDateString(locale, {...})       → formato regional
 *
 * PERSISTENCIA: localStorage['ra-lang']. Se aplica también a <html lang="..">
 * por accesibilidad y para que el navegador ofrezca la traducción correcta.
 */
import {
  createContext, useContext, useState, useCallback, useMemo, useEffect,
  type ReactNode,
} from 'react'
import { dictionaries, type TranslationKey } from './dictionary'

export type Lang = 'es' | 'en'

const STORAGE_KEY = 'ra-lang'

/** Locale BCP-47 por idioma — gobierna fechas, números y moneda. */
export const LOCALES: Record<Lang, string> = {
  es: 'es-CO',
  en: 'en-US',
}

/**
 * Idioma inicial: preferencia guardada > idioma del navegador > español.
 * Español es el default porque es el idioma de operación de la firma.
 */
function detectInitialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'es' || saved === 'en') return saved
  } catch { /* localStorage bloqueado (modo privado) → seguir al fallback */ }
  try {
    if (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('en')) {
      return 'en'
    }
  } catch { /* noop */ }
  return 'es'
}

type Vars = Record<string, string | number>

/**
 * Idioma vigente a nivel de módulo. Lo mantiene sincronizado el provider.
 * Existe SOLO para `tStatic` — ver abajo.
 */
let currentLang_: Lang = detectInitialLang()

/** Reemplaza {{clave}} por su valor. Deja intacto lo que no encuentre. */
function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match
  )
}

/**
 * Traducción fuera de React: helpers a nivel de módulo, funciones de badge y
 * capas de API que no pueden llamar a un hook.
 *
 * CUÁNDO USARLA: solo donde `useI18n()` es imposible. Dentro de un componente
 * usa SIEMPRE `t` del hook — es el que dispara el re-render al cambiar idioma.
 *
 * POR QUÉ ES SEGURA: lee el idioma en el momento de la llamada, no al importar.
 * Los mensajes imperativos (toasts) salen siempre en el idioma vigente, y los
 * helpers de render se recalculan porque el componente que los invoca sí está
 * suscrito al contexto.
 */
/**
 * Locale BCP-47 vigente, para `toLocaleDateString` y compañía fuera de React.
 * Las fechas SÍ cambian de formato con el idioma (11 sept 2026 / Sep 11, 2026);
 * la moneda se mantiene en formato en-US a propósito: son dólares y los
 * documentos del lender, el HUD y los draws se leen así en ambos idiomas.
 */
export function currentLocale(): string {
  return LOCALES[currentLang_]
}

/**
 * Idioma vigente fuera de React. Lo usan los clientes axios para enviar
 * `Accept-Language`, con lo que el backend traduce sus mensajes de error.
 */
export function currentLang(): Lang {
  return currentLang_
}

/**
 * Aplica el idioma guardado al documento ANTES de que React monte: <html lang>,
 * <title> y el texto del splash, que viven en index.html y por tanto nacen en
 * español. El CSP del backend (`script-src 'self'`) prohíbe scripts inline en
 * el HTML, así que este arranque tiene que ejecutarse desde el bundle.
 */
export function bootstrapDocumentLanguage(): void {
  const dict = dictionaries[currentLang_]
  document.documentElement.setAttribute('lang', currentLang_)
  document.title = dict['app.title']
  const splash = document.getElementById('app-loading-text')
  if (splash) splash.textContent = dict['app.splashLoading']
  const desc = document.querySelector('meta[name="description"]')
  if (desc) desc.setAttribute('content', dict['app.description'])
}

export function tStatic(key: TranslationKey, vars?: Vars): string {
  const raw = dictionaries[currentLang_][key]
  if (raw === undefined) {
    console.warn(`[i18n] clave sin traducción: ${key}`)
    return key
  }
  return interpolate(raw, vars)
}

interface I18nValue {
  lang: Lang
  locale: string
  setLang: (l: Lang) => void
  toggle: () => void
  /** Traduce una clave, con interpolación opcional. */
  t: (key: TranslationKey, vars?: Vars) => string
  /** Traduce con plural: busca `key_one` / `key_other` según `count`. */
  tc: (baseKey: string, count: number, vars?: Vars) => string
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectInitialLang)

  // Mantener <html lang> sincronizado: lectores de pantalla, corrector
  // ortográfico del navegador y SEO dependen de este atributo.
  useEffect(() => {
    document.documentElement.setAttribute('lang', lang)
    currentLang_ = lang
    document.title = dictionaries[lang]['app.title']
    const desc = document.querySelector('meta[name="description"]')
    if (desc) desc.setAttribute('content', dictionaries[lang]['app.description'])
  }, [lang])

  const setLang = useCallback((l: Lang) => {
    currentLang_ = l
    setLangState(l)
    try { localStorage.setItem(STORAGE_KEY, l) } catch { /* noop */ }
  }, [])

  const toggle = useCallback(() => {
    setLangState(prev => {
      const next: Lang = prev === 'es' ? 'en' : 'es'
      currentLang_ = next
      try { localStorage.setItem(STORAGE_KEY, next) } catch { /* noop */ }
      return next
    })
  }, [])

  const value = useMemo<I18nValue>(() => {
    const dict = dictionaries[lang]

    const t = (key: TranslationKey, vars?: Vars): string => {
      const raw = dict[key]
      if (raw === undefined) {
        // No debería ocurrir: TypeScript garantiza cobertura. Si pasa, es una
        // clave construida dinámicamente y con cast — se muestra la clave para
        // que el error sea visible en vez de silencioso.
        console.warn(`[i18n] clave sin traducción: ${key}`)
        return key
      }
      return interpolate(raw, vars)
    }

    const tc = (baseKey: string, count: number, vars?: Vars): string => {
      const suffix = count === 1 ? '_one' : '_other'
      return t(`${baseKey}${suffix}` as TranslationKey, { count, ...vars })
    }

    return { lang, locale: LOCALES[lang], setLang, toggle, t, tc }
  }, [lang, setLang, toggle])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n debe usarse dentro de <I18nProvider>')
  return ctx
}

export type { TranslationKey }
