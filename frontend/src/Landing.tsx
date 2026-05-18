import { Link } from 'react-router-dom'
import { Building2, Wallet, ArrowRight, Shield, Download, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { logout } from './components/AuthGate'

const TOKEN_KEY = 'pm_auth_token'

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
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--brand-teal)' }}
          >
            <Shield size={20} color="var(--brand-gold)" />
          </div>
          <div>
            <div className="text-xs font-mono uppercase tracking-widest" style={{ color: 'var(--brand-teal)' }}>
              Restrepo Acosta
            </div>
            <div className="text-sm font-semibold" style={{ color: 'var(--brand-teal)' }}>
              Global Holding LLC
            </div>
          </div>
        </div>
        <button
          onClick={logout}
          className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--brand-teal)', border: '1px solid rgba(45,75,82,0.2)' }}
        >
          Cerrar sesión
        </button>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="max-w-5xl w-full">
          <div className="text-center mb-10">
            <h1
              className="text-4xl md:text-5xl font-semibold mb-4 leading-tight"
              style={{ color: 'var(--brand-teal)', fontFamily: 'Inter' }}
            >
              Ecosistema operativo
            </h1>
            <p className="text-base md:text-lg max-w-2xl mx-auto" style={{ color: 'var(--brand-teal2)' }}>
              Selecciona el módulo con el que deseas trabajar. Ambos comparten el mismo acceso seguro.
            </p>
          </div>

          {/* Module cards */}
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Módulo Técnico */}
            <Link
              to="/tech"
              className="group relative overflow-hidden rounded-2xl p-8 transition-all duration-300 hover:-translate-y-1"
              style={{
                background: 'linear-gradient(135deg, var(--brand-teal) 0%, var(--brand-teal2) 100%)',
                boxShadow: '0 10px 30px -10px rgba(45, 75, 82, 0.4)',
              }}
            >
              <div
                className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10 -mt-8 -mr-8"
                style={{ background: 'var(--brand-gold)' }}
              />
              <div className="relative">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center mb-6"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
                >
                  <Building2 size={26} color="var(--brand-gold2)" />
                </div>
                <div className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: 'var(--brand-gold2)' }}>
                  Módulo 01
                </div>
                <h2 className="text-2xl font-semibold text-white mb-3">Técnico</h2>
                <p className="text-sm leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  Gestión de obra residencial: proyectos, fases, presupuestos, ejecución, draws,
                  inspecciones, alertas y proveedores.
                </p>
                <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--brand-gold2)' }}>
                  Entrar al módulo
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </Link>

            {/* Módulo Financiero */}
            <Link
              to="/finance"
              className="group relative overflow-hidden rounded-2xl p-8 transition-all duration-300 hover:-translate-y-1"
              style={{
                background: 'linear-gradient(135deg, #0F2027 0%, #1B3640 100%)',
                boxShadow: '0 10px 30px -10px rgba(15, 32, 39, 0.5)',
              }}
            >
              <div
                className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10 -mt-8 -mr-8"
                style={{ background: '#22c55e' }}
              />
              <div className="relative">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center mb-6"
                  style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.18)' }}
                >
                  <Wallet size={26} color="#5eead4" />
                </div>
                <div className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: '#5eead4' }}>
                  Módulo 02
                </div>
                <h2 className="text-2xl font-semibold text-white mb-3">Financiero</h2>
                <p className="text-sm leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  CFO digital: movimientos, capital aportado, deuda, conciliación bancaria,
                  reportes ejecutivos y trazabilidad documental.
                </p>
                <div className="flex items-center gap-2 text-sm font-medium" style={{ color: '#5eead4' }}>
                  Entrar al módulo
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </Link>
          </div>

          {/* Backup panel — global del sistema */}
          <div className="max-w-4xl mx-auto mt-6">
            <div
              className="rounded-2xl p-5 flex items-center gap-4 flex-wrap"
              style={{
                background: 'rgba(255,255,255,0.6)',
                border: '1px solid rgba(45,75,82,0.12)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--brand-teal)', boxShadow: '0 4px 12px rgba(45,75,82,0.2)' }}
              >
                <Download size={20} color="var(--brand-gold2)" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold mb-0.5" style={{ color: 'var(--brand-teal)' }}>
                  Respaldo completo del sistema
                </div>
                <div className="text-xs" style={{ color: 'var(--brand-teal2)' }}>
                  Datos de ambos módulos · código fuente · configuración · ZIP único
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
                  background: 'linear-gradient(135deg, var(--brand-gold) 0%, var(--brand-gold2) 100%)',
                  color: 'white',
                  boxShadow: '0 4px 14px rgba(200,146,42,0.25)',
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
            Acceso seguro · sesión única para ambos módulos · clave 18418598
          </div>
        </div>
      </main>

      <footer className="py-6 text-center text-xs" style={{ color: 'var(--brand-teal2)' }}>
        © {new Date().getFullYear()} Restrepo Acosta Global Holding LLC
      </footer>
    </div>
  )
}
