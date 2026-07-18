import { useState, useEffect } from 'react'
import axios from 'axios'
import { Lock, Eye, EyeOff, AlertCircle } from 'lucide-react'

function RALogoMark({ width = 80, height = 60 }: { width?: number; height?: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="58" width="14" height="22" fill="#1D1D1F" opacity="0.55"/>
      <rect x="7" y="63" width="3" height="3" fill="rgba(255,255,255,0.35)"/>
      <rect x="12" y="63" width="3" height="3" fill="rgba(255,255,255,0.35)"/>
      <rect x="7" y="70" width="3" height="3" fill="rgba(255,255,255,0.35)"/>
      <rect x="12" y="70" width="3" height="3" fill="rgba(255,255,255,0.35)"/>
      <rect x="20" y="42" width="20" height="38" fill="#1D1D1F" opacity="0.78"/>
      <rect x="23" y="47" width="5" height="5" fill="rgba(255,255,255,0.35)"/>
      <rect x="31" y="47" width="5" height="5" fill="rgba(255,255,255,0.35)"/>
      <rect x="23" y="56" width="5" height="5" fill="rgba(255,255,255,0.35)"/>
      <rect x="31" y="56" width="5" height="5" fill="rgba(255,255,255,0.35)"/>
      <rect x="23" y="65" width="5" height="5" fill="rgba(255,255,255,0.35)"/>
      <rect x="31" y="65" width="5" height="5" fill="rgba(255,255,255,0.35)"/>
      <rect x="43" y="6" width="34" height="74" fill="#1D1D1F"/>
      <rect x="59" y="0" width="2.5" height="8" fill="#1D1D1F"/>
      <rect x="56" y="6" width="8" height="3" fill="#1D1D1F"/>
      <rect x="47" y="13" width="6" height="6" fill="rgba(255,255,255,0.38)"/>
      <rect x="67" y="13" width="6" height="6" fill="rgba(255,255,255,0.38)"/>
      <rect x="47" y="24" width="6" height="6" fill="rgba(255,255,255,0.38)"/>
      <rect x="67" y="24" width="6" height="6" fill="rgba(255,255,255,0.38)"/>
      <rect x="47" y="35" width="6" height="6" fill="rgba(255,255,255,0.38)"/>
      <rect x="67" y="35" width="6" height="6" fill="rgba(255,255,255,0.38)"/>
      <rect x="47" y="46" width="6" height="6" fill="rgba(255,255,255,0.38)"/>
      <rect x="67" y="46" width="6" height="6" fill="rgba(255,255,255,0.38)"/>
      <rect x="47" y="57" width="6" height="6" fill="rgba(255,255,255,0.38)"/>
      <rect x="67" y="57" width="6" height="6" fill="rgba(255,255,255,0.38)"/>
      <rect x="58" y="13" width="4" height="6" fill="rgba(255,255,255,0.2)"/>
      <rect x="58" y="24" width="4" height="6" fill="rgba(255,255,255,0.2)"/>
      <rect x="58" y="35" width="4" height="6" fill="rgba(255,255,255,0.2)"/>
      <rect x="80" y="38" width="20" height="42" fill="#1D1D1F" opacity="0.78"/>
      <rect x="83" y="43" width="5" height="5" fill="rgba(255,255,255,0.35)"/>
      <rect x="91" y="43" width="5" height="5" fill="rgba(255,255,255,0.35)"/>
      <rect x="83" y="52" width="5" height="5" fill="rgba(255,255,255,0.35)"/>
      <rect x="91" y="52" width="5" height="5" fill="rgba(255,255,255,0.35)"/>
      <rect x="83" y="61" width="5" height="5" fill="rgba(255,255,255,0.35)"/>
      <rect x="91" y="61" width="5" height="5" fill="rgba(255,255,255,0.35)"/>
      <rect x="83" y="70" width="5" height="5" fill="rgba(255,255,255,0.35)"/>
      <rect x="91" y="70" width="5" height="5" fill="rgba(255,255,255,0.35)"/>
      <rect x="103" y="54" width="14" height="26" fill="#1D1D1F" opacity="0.55"/>
      <rect x="106" y="59" width="3" height="3" fill="rgba(255,255,255,0.35)"/>
      <rect x="111" y="59" width="3" height="3" fill="rgba(255,255,255,0.35)"/>
      <rect x="106" y="66" width="3" height="3" fill="rgba(255,255,255,0.35)"/>
      <rect x="111" y="66" width="3" height="3" fill="rgba(255,255,255,0.35)"/>
      <rect x="0" y="80" width="120" height="1.5" fill="#1D1D1F" opacity="0.3"/>
      <path d="M 8 85 Q 60 72 112 85" stroke="#3E5A70" strokeWidth="3" fill="none" strokeLinecap="round"/>
    </svg>
  )
}

const TOKEN_KEY = 'pm_auth_token'
const API = '/api/auth'

async function verifyToken(token: string): Promise<boolean> {
  try {
    const r = await axios.get(`${API}/verify`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    return r.data.valid === true
  } catch {
    return false
  }
}

export function useAuth() {
  const [authed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) { setAuthed(false); return }
    verifyToken(token).then(valid => {
      if (!valid) localStorage.removeItem(TOKEN_KEY)
      setAuthed(valid)
    })
  }, [])

  return authed
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY)
  window.location.reload()
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const authed = useAuth()
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (authed === null) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: 'var(--brand-cream)' }}>
        <div className="text-sm font-mono animate-pulse" style={{ color: 'var(--brand-teal)' }}>
          Verificando acceso...
        </div>
      </div>
    )
  }

  if (authed) return <>{children}</>

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const r = await axios.post(`${API}/login`, { password })
      localStorage.setItem(TOKEN_KEY, r.data.token)
      window.location.reload()
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { error?: string } } }
      if (e.response?.status === 429) {
        setError('Demasiados intentos fallidos. Espera 15 minutos.')
      } else {
        setError(e.response?.data?.error ?? 'Error de conexión')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center h-screen" style={{ background: 'var(--brand-cream)' }}>
      {/* Card */}
      <div className="w-full max-w-sm mx-4 bg-white rounded-3xl overflow-hidden"
        style={{ boxShadow: '0 20px 60px rgba(29,29,31,0.15)', border: '1px solid rgba(29,29,31,0.1)' }}>

        {/* Header strip */}
        <div className="h-1.5" style={{ background: 'linear-gradient(90deg, #1D1D1F 0%, #3E5A70 100%)' }} />

        <div className="px-8 py-10">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <RALogoMark width={100} height={75} />
            <h1
              className="text-xl font-bold tracking-wide text-center mt-3"
              style={{ color: '#1D1D1F', letterSpacing: '0.04em' }}
            >
              Restrepo Acosta
            </h1>
            <p className="text-[10px] uppercase tracking-[0.2em] font-semibold mt-0.5" style={{ color: '#3E5A70' }}>
              Global Holdings LLC
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider"
                style={{ color: '#1D1D1F' }}>
                Contraseña de acceso
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: 'rgba(29,29,31,0.4)' }} />
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  autoFocus
                  className="w-full pl-10 pr-10 py-3 rounded-xl text-sm font-mono transition-all"
                  style={{
                    border: error ? '1px solid #ef4444' : '1px solid rgba(29,29,31,0.2)',
                    background: 'var(--brand-cream)',
                    color: '#1A2E32',
                    outline: 'none',
                  }}
                  onFocus={e => {
                    e.currentTarget.style.border = '1px solid #3E5A70'
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(62,90,112,0.15)'
                  }}
                  onBlur={e => {
                    e.currentTarget.style.border = error
                      ? '1px solid #ef4444'
                      : '1px solid rgba(29,29,31,0.2)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
                  style={{ color: 'rgba(29,29,31,0.4)' }}
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-3 text-sm font-semibold text-white rounded-xl transition-all disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #3E5A70 0%, #4A6880 100%)',
                boxShadow: '0 4px 14px rgba(62,90,112,0.3)',
              }}
              onMouseEnter={e => !loading && (e.currentTarget.style.transform = 'translateY(-1px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
            >
              {loading ? 'Verificando...' : 'Ingresar al sistema'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="px-8 pb-6 text-center">
          <p className="text-[10px]" style={{ color: 'rgba(29,29,31,0.35)' }}>
            Sistema privado · Acceso restringido
          </p>
        </div>
      </div>
    </div>
  )
}
