/**
 * ModuleGate — segunda capa de autenticación por módulo.
 *
 * Después del AuthGate global, cada módulo (técnico / financiero) pide su
 * propia contraseña. El estado se guarda en sessionStorage para que
 * persista durante la sesión del navegador, pero se borre al cerrarlo.
 *
 * La contraseña se valida ÚNICAMENTE contra el backend (POST /api/auth/login).
 * NUNCA hardcodear contraseñas en el frontend: el bundle JS es público y
 * cualquiera puede leerlas con "ver código fuente".
 */
import { useState, useEffect, ReactNode } from 'react'
import { Lock, ArrowLeft, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import axios from 'axios'

const STORAGE_KEY = (m: string) => `ra_module_unlocked_${m}`

interface Props {
  moduleName: 'tech' | 'finance' | 'admin'
  moduleLabel: string
  children: ReactNode
}

export default function ModuleGate({ moduleName, moduleLabel, children }: Props) {
  const [unlocked, setUnlocked] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Si ya se desbloqueó en esta sesión, no volver a pedir
    const stored = sessionStorage.getItem(STORAGE_KEY(moduleName))
    if (stored === '1') setUnlocked(true)
  }, [moduleName])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      // Validación EXCLUSIVAMENTE contra el backend — sin comparación local
      const res = await axios.post('/api/auth/login', { password })
      if (res.data?.token) {
        sessionStorage.setItem(STORAGE_KEY(moduleName), '1')
        setUnlocked(true)
        setPassword('')
      } else {
        setError('Contraseña incorrecta')
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Contraseña incorrecta')
    } finally {
      setLoading(false)
    }
  }

  if (unlocked) return <>{children}</>

  const isFinance = moduleName === 'finance'
  const isAdmin = moduleName === 'admin'
  const accent = isAdmin ? '#8b5cf6' : isFinance ? '#0d9488' : 'var(--brand-gold)'
  const bg = isAdmin
    ? 'linear-gradient(135deg, #2A1E3F 0%, #3E2C5C 100%)'
    : isFinance
    ? 'linear-gradient(135deg, #0F2027 0%, #1B3640 100%)'
    : 'linear-gradient(135deg, var(--brand-teal) 0%, #48484A 100%)'

  return (
    <div
      className="flex items-center justify-center min-h-screen p-4"
      style={{ background: 'var(--brand-cream)' }}
    >
      <div
        className="w-full max-w-sm rounded-3xl overflow-hidden bg-white"
        style={{
          boxShadow: '0 20px 60px rgba(29,29,31,0.15)',
          border: '1px solid rgba(29,29,31,0.1)',
        }}
      >
        {/* Header con gradiente brand */}
        <div className="h-1.5" style={{ background: bg }} />
        <div className="px-8 py-10">
          {/* Logo + título */}
          <div className="flex flex-col items-center mb-6">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
              style={{ background: bg, boxShadow: `0 4px 16px ${isFinance ? 'rgba(13,148,136,0.4)' : 'rgba(29,29,31,0.4)'}` }}
            >
              <ShieldCheck size={26} color="white" />
            </div>
            <h1
              className="text-lg font-bold tracking-wide text-center"
              style={{ color: 'var(--brand-teal)', letterSpacing: '0.04em' }}
            >
              {moduleLabel}
            </h1>
            <p
              className="text-[10px] uppercase tracking-[0.2em] font-semibold mt-1"
              style={{ color: accent }}
            >
              Restrepo Acosta · Global Holding
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                className="block text-xs font-semibold mb-1.5 uppercase tracking-wider"
                style={{ color: 'var(--brand-teal)' }}
              >
                Contraseña de acceso al módulo
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'rgba(29,29,31,0.4)' }}
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError('') }}
                  placeholder="••••••••"
                  autoFocus
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm font-mono transition-all"
                  style={{
                    background: 'var(--brand-cream)',
                    color: 'var(--brand-teal)',
                    border: `1px solid ${error ? '#dc2626' : 'rgba(29,29,31,0.2)'}`,
                    outline: 'none',
                  }}
                />
              </div>
              {error && (
                <p className="text-xs text-red-600 mt-1.5 font-semibold">{error}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={!password || loading}
              className="w-full py-3 text-sm font-semibold text-white rounded-xl transition-all disabled:opacity-50"
              style={{
                background: bg,
                boxShadow: '0 4px 14px rgba(29,29,31,0.25)',
              }}
            >
              {loading ? 'Verificando…' : `Ingresar a ${moduleLabel}`}
            </button>
          </form>

          <div className="mt-6 pt-4 text-center" style={{ borderTop: '1px solid rgba(29,29,31,0.08)' }}>
            <Link
              to="/"
              className="text-xs font-semibold inline-flex items-center gap-1 hover:underline"
              style={{ color: 'var(--brand-teal2)' }}
            >
              <ArrowLeft size={12} /> Volver al inicio
            </Link>
          </div>
        </div>

        <div className="px-8 pb-6 text-center">
          <p className="text-[10px]" style={{ color: 'rgba(29,29,31,0.4)' }}>
            Acceso protegido · Sesión válida hasta cerrar el navegador
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * Hook auxiliar para que componentes puedan "cerrar sesión" del módulo
 * (ej. botón "salir" del sidebar) → fuerza re-pedir password.
 */
export function lockModule(moduleName: 'tech' | 'finance') {
  sessionStorage.removeItem(STORAGE_KEY(moduleName))
}
