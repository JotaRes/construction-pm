import { Link } from 'react-router-dom'
import { Building2, Wallet, Landmark, ArrowRight, Download, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { logout } from './components/AuthGate'
import HomeExecutiveDashboard from './components/HomeExecutiveDashboard'

const TOKEN_KEY = 'pm_auth_token'

function RALogoMark({ width = 96, height = 72 }: { width?: number; height?: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 90 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ra-lt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1D1D1F"/>
          <stop offset="100%" stopColor="#1D1D1F"/>
        </linearGradient>
        <linearGradient id="ra-rt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#48484A"/>
          <stop offset="100%" stopColor="#1D1D1F"/>
        </linearGradient>
        <filter id="ra-glow">
          <feGaussianBlur stdDeviation="1.2" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {/* Torre izquierda — alta, tejado diagonal ascendente */}
      <polygon points="12,74 12,18 41,6 41,74" fill="url(#ra-lt)"/>
      {/* Destello interior torre izquierda */}
      <polygon points="12,18 12,32 20,28 20,14" fill="rgba(255,255,255,0.07)"/>
      {/* Torre derecha — más corta */}
      <polygon points="46,74 46,28 67,20 67,74" fill="url(#ra-rt)"/>
      {/* Destello interior torre derecha */}
      <polygon points="46,28 46,38 52,35 52,25" fill="rgba(255,255,255,0.07)"/>
      {/* Arco azul — la firma de la marca (acento único del sistema) */}
      <path d="M 5,68 Q 42,50 82,61" stroke="#0071E3" strokeWidth="5.5" fill="none" strokeLinecap="round"/>
    </svg>
  )
}

export default function Landing() {
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')

  async function handleBackup() {
    setDownloading(true)
    setDownloadError('')
    try {
      const token = localStorage.getItem(TOKEN_KEY)
      const res = await fetch('/api/backup', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const date = new Date().toISOString().split('T')[0]
      a.download = `restrepoacosta-backup-${date}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      setDownloadError(
        err instanceof Error ? err.message : 'No se pudo descargar el respaldo'
      )
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: 'linear-gradient(180deg, var(--brand-cream2) 0%, var(--brand-cream) 100%)',
      }}
    >
      {/* Header */}
      <header className="px-8 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <RALogoMark width={44} height={33} />
          <div>
            <div className="text-sm font-bold tracking-wide" style={{ color: 'var(--brand-teal)' }}>
              Restrepo Acosta
            </div>
            <div className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--brand-gold)' }}>
              Global Holdings LLC
            </div>
          </div>
        </div>
        <button
          onClick={logout}
          className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--brand-teal)', border: '1px solid rgba(29,29,31,0.2)' }}
        >
          Cerrar sesión
        </button>
      </header>

      {/* Contenido */}
      <main className="flex-1 flex flex-col items-center px-6 py-6">
        <div className="max-w-6xl w-full">
          {/* Hero compacto */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-3">
              <RALogoMark width={96} height={72} />
            </div>
            <h1
              className="text-2xl md:text-3xl font-bold mb-1 leading-tight"
              style={{ color: 'var(--brand-teal)', letterSpacing: '0.04em' }}
            >
              Restrepo Acosta
            </h1>
            <div
              className="text-[11px] uppercase tracking-[0.25em] font-semibold"
              style={{ color: 'var(--brand-gold)' }}
            >
              Global Holdings LLC
            </div>
          </div>

          {/* === DASHBOARD EJECUTIVO (primero, cruce técnico + financiero) === */}
          <section className="mb-10">
            <HomeExecutiveDashboard />
          </section>

          {/* === MÓDULOS (debajo del dashboard) === */}
          <div className="text-center mb-4">
            <div
              className="inline-block text-[11px] uppercase tracking-[0.18em] px-4 py-1 rounded-full"
              style={{ background: 'rgba(29,29,31,0.07)', color: 'var(--brand-teal2)' }}
            >
              Entrar a los módulos
            </div>
          </div>

          {/* Module cards — UNA sola familia visual (sistema fijo): superficie
              blanca, borde hairline, icono monocromo en squircle neutro, enlace
              en el único acento. La diferencia entre módulos la da el contenido,
              no el color. */}
          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {[
              {
                to: '/tech', num: '01', title: 'Técnico', Icon: Building2,
                desc: 'Gestión de obra residencial: proyectos, fases, presupuestos, ejecución, draws, inspecciones, alertas y proveedores.',
              },
              {
                to: '/finance', num: '02', title: 'Financiero', Icon: Wallet,
                desc: 'CFO digital: movimientos, capital aportado, deuda, conciliación bancaria, reportes ejecutivos y trazabilidad documental.',
              },
              {
                to: '/admin', num: '03', title: 'Administrativo', Icon: Landmark,
                desc: 'Gobierno corporativo: organigrama del holding, expediente jurídico y documental de cada empresa, cumplimiento, alertas de vencimiento y tareas.',
              },
            ].map(({ to, num, title, Icon, desc }) => (
              <Link
                key={to}
                to={to}
                className="group rounded-2xl p-8 transition-all duration-200 hover:-translate-y-0.5"
                style={{
                  background: '#FFFFFF',
                  border: '1px solid rgba(0,0,0,0.08)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6"
                  style={{ background: '#F5F5F7' }}
                >
                  <Icon size={24} strokeWidth={1.8} color="#1D1D1F" />
                </div>
                <div className="text-[11px] uppercase tracking-[0.18em] font-medium mb-2" style={{ color: '#86868B' }}>
                  Módulo {num}
                </div>
                <h2 className="text-2xl font-semibold mb-3" style={{ color: '#1D1D1F', letterSpacing: '-0.02em' }}>{title}</h2>
                <p className="text-sm leading-relaxed mb-6" style={{ color: '#48484A' }}>
                  {desc}
                </p>
                <div className="flex items-center gap-2 text-sm font-medium" style={{ color: '#0071E3' }}>
                  Entrar al módulo
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </div>

          {/* Backup panel — global del sistema */}
          <div className="max-w-4xl mx-auto mt-6">
            <div
              className="rounded-2xl p-5 flex items-center gap-4 flex-wrap"
              style={{
                background: 'rgba(255,255,255,0.6)',
                border: '1px solid rgba(29,29,31,0.12)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: '#F5F5F7' }}
              >
                <Download size={20} strokeWidth={1.8} color="#1D1D1F" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold mb-0.5" style={{ color: 'var(--brand-teal)' }}>
                  Respaldo completo del sistema
                </div>
                <div className="text-xs" style={{ color: 'var(--brand-teal2)' }}>
                  Datos de ambos módulos · 2 dashboards Excel · código fuente · ZIP único
                </div>
                {downloadError && (
                  <div className="text-xs mt-1 text-red-500">Error: {downloadError}</div>
                )}
              </div>
              <button
                onClick={handleBackup}
                disabled={downloading}
                className="text-sm font-medium px-4 py-2 rounded-lg transition-all disabled:opacity-60 flex items-center gap-2"
                style={{
                  background: '#0071E3',
                  color: 'white',
                }}
              >
                {downloading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Generando…
                  </>
                ) : (
                  <>
                    <Download size={14} />
                    Descargar backup
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Footer info */}
          <div className="text-center mt-8 text-xs font-mono" style={{ color: 'var(--brand-teal2)' }}>
            Acceso seguro · sesión única para ambos módulos
          </div>
        </div>
      </main>

      <footer className="py-6 text-center text-xs" style={{ color: 'var(--brand-teal2)' }}>
        © {new Date().getFullYear()} Restrepo Acosta Global Holding LLC
      </footer>
    </div>
  )
}
