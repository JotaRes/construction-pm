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

/** Reemplaza {{clave}} por su valor. Deja intacto lo que no encuentre. */
function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match
  )
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
  }, [lang])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try { localStorage.setItem(STORAGE_KEY, l) } catch { /* noop */ }
  }, [])

  const toggle = useCallback(() => {
    setLangState(prev => {
      const next: Lang = prev === 'es' ? 'en' : 'es'
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
