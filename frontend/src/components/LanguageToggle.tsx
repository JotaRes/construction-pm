/**
 * LanguageToggle — conmutador ES / EN
 * ─────────────────────────────────────────────────────────────────────────────
 * Segmented control de dos posiciones, coherente con el design system del
 * holding (hairline neutro, un solo acento, tipografía mono en mayúsculas).
 *
 * Se prefirió un segmented control sobre un botón de bandera o un dropdown:
 * el estado actual es visible sin abrir nada y el cambio es un solo clic.
 *
 * Variantes:
 *   'bar'   — para topbars de módulo (fondo transparente, borde hairline)
 *   'light' — para la Landing y las pantallas de acceso (fondo blanco)
 */
import { useI18n, type Lang } from '../i18n'

const OPTIONS: Array<{ value: Lang; label: string; aria: string }> = [
  { value: 'es', label: 'ES', aria: 'Español' },
  { value: 'en', label: 'EN', aria: 'English' },
]

export default function LanguageToggle({ variant = 'bar' }: { variant?: 'bar' | 'light' }) {
  const { lang, setLang, t } = useI18n()

  const isLight = variant === 'light'

  return (
    <div
      role="group"
      aria-label={t('lang.label')}
      title={t('lang.switchTo')}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 32,
        padding: 2,
        gap: 2,
        borderRadius: 8,
        border: `1px solid ${isLight ? 'rgba(29,29,31,0.14)' : 'var(--border)'}`,
        background: isLight ? 'rgba(255,255,255,0.7)' : 'transparent',
        flexShrink: 0,
      }}
    >
      {OPTIONS.map(opt => {
        const active = lang === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setLang(opt.value)}
            aria-pressed={active}
            aria-label={opt.aria}
            style={{
              minWidth: 30,
              height: 26,
              padding: '0 7px',
              border: 'none',
              borderRadius: 6,
              cursor: active ? 'default' : 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.08em',
              lineHeight: 1,
              transition: 'background 0.18s, color 0.18s',
              background: active
                ? (isLight ? '#3E5A70' : 'var(--accent)')
                : 'transparent',
              color: active
                ? '#FFFFFF'
                : (isLight ? 'rgba(29,29,31,0.55)' : 'var(--text-secondary)'),
            }}
            onMouseEnter={e => {
              if (!active) {
                (e.currentTarget as HTMLButtonElement).style.background = isLight
                  ? 'rgba(29,29,31,0.06)'
                  : 'var(--row-hover-v2)'
              }
            }}
            onMouseLeave={e => {
              if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
