import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Sparkles, Search, X, ArrowRight, HelpCircle } from 'lucide-react'

type Mod = 'tech' | 'finance'
interface Entry {
  path: string
  label: string
  mod: Mod
  section: string
  keywords: string[]
  help: string
}

// Índice del sistema: cada sección con sinónimos (palabras clave) y una ayuda
// en lenguaje simple. Sin IA: buscamos por coincidencia de palabras y navegamos.
const ENTRIES: Entry[] = [
  // ── MÓDULO TÉCNICO ──
  { path: '/tech/projects', label: 'Proyectos', mod: 'tech', section: 'Portafolio', keywords: ['proyecto', 'lote', 'casa', 'obra', 'portafolio', 'crear proyecto'], help: 'Lista de proyectos/lotes. Aquí seleccionas o creas el proyecto activo.' },
  { path: '/tech/dashboard', label: 'Dashboard técnico', mod: 'tech', section: 'Portafolio', keywords: ['dashboard', 'resumen', 'tablero', 'inicio', 'general'], help: 'Vista general del proyecto: avance, presupuesto, indicadores.' },
  { path: '/tech/budget', label: 'Presupuesto', mod: 'tech', section: 'Ejecución', keywords: ['presupuesto', 'budget', 'costos', 'valor presupuestado', 'partidas'], help: 'Presupuesto por actividad del proyecto.' },
  { path: '/tech/execution', label: 'Ejecución', mod: 'tech', section: 'Ejecución', keywords: ['ejecucion', 'avance', 'obra', 'actividades', 'ejecutado', 'fechas', 'factura', 'documentos', 'cantidad', 'unidad'], help: 'Control de obra: marcas de avance, valor ejecutado, fechas (alimentan el Gantt), unidad y cantidad, y adjuntar facturas por actividad.' },
  { path: '/tech/phases', label: 'Fases', mod: 'tech', section: 'Ejecución', keywords: ['fases', 'etapas', 'phase', 'divisiones'], help: 'Fases del proyecto y su progreso.' },
  { path: '/tech/construction-budget', label: 'Const. Budget', mod: 'tech', section: 'Ejecución', keywords: ['construction budget', 'budget lender', 'lineas', 'aprobado', 'presentado', 'cantidad', 'importar pdf'], help: 'Construction Budget del lender: valor inicial, presentado, aprobado (auto desde Draws) y cantidad por línea.' },
  { path: '/tech/draws', label: 'Draws', mod: 'tech', section: 'Ejecución', keywords: ['draw', 'draws', 'desembolso', 'holdback', 'wire', 'netwire', 'girar', 'lender', 'excel del lender', 'aprobado', 'saldo', 'retencion'], help: 'Draw Tracker: desembolsos, holdback, saldo pendiente por girar, total aprobado y el Excel general del lender que valida los PDF.' },
  { path: '/tech/inspections', label: 'Inspecciones', mod: 'tech', section: 'Ejecución', keywords: ['inspeccion', 'inspecciones', 'trinity', 'wbs', 'prerrequisitos'], help: 'Inspecciones del proyecto y su estado.' },
  { path: '/tech/gantt', label: 'Gantt', mod: 'tech', section: 'Ejecución', keywords: ['gantt', 'cronograma', 'calendario', 'fechas', 'linea de tiempo', 'schedule'], help: 'Cronograma de obra. Se alimenta de las fechas de inicio/fin de cada actividad en Ejecución.' },
  { path: '/tech/financial', label: 'Financiero (técnico)', mod: 'tech', section: 'Análisis', keywords: ['financiero', 'proyecciones', 'margen', 'utilidad', 'arv'], help: 'Análisis financiero del proyecto técnico.' },
  { path: '/tech/alerts', label: 'Alertas', mod: 'tech', section: 'Análisis', keywords: ['alertas', 'vencidas', 'permiso', 'holdback', 'facturas faltantes', 'cronograma', 'avisos'], help: 'Alertas: permiso por vencer, presupuesto, holdback, actividades vencidas y facturas faltantes.' },
  { path: '/tech/tasks', label: 'Tareas y Notas', mod: 'tech', section: 'Análisis', keywords: ['tareas', 'notas', 'pendientes', 'recordatorios', 'to do', 'fecha limite', 'vencidas'], help: 'Tareas y Notas juntas. Ambas pueden llevar fecha y generar alerta si no se cumplen.' },
  { path: '/tech/providers', label: 'Proveedores', mod: 'tech', section: 'Operaciones', keywords: ['proveedores', 'contratistas', 'vendor', 'subcontratista'], help: 'Directorio de proveedores y contratistas.' },
  { path: '/tech/subcontracts', label: 'Subcontratos', mod: 'tech', section: 'Operaciones', keywords: ['subcontratos', 'contratos', 'hitos', 'pagos'], help: 'Contratos de subcontratistas y calendario de pagos por hito.' },
  { path: '/tech/gallery', label: 'Galería', mod: 'tech', section: 'Operaciones', keywords: ['galeria', 'fotos', 'imagenes', 'progreso visual'], help: 'Fotos del avance de obra.' },
  { path: '/tech/files', label: 'Archivos', mod: 'tech', section: 'Operaciones', keywords: ['archivos', 'documentos', 'subir', 'cargar', 'pdf', 'word', 'excel', 'imagen', 'extraer'], help: 'Documentos del proyecto. Al subir un archivo (PDF, Word, Excel, imagen) el sistema extrae los datos y autocompleta casillas.' },
  { path: '/tech/price-refs', label: 'Precios de Referencia', mod: 'tech', section: 'Operaciones', keywords: ['precios', 'referencia', 'promedio', 'unidad', 'pie cuadrado', 'yarda', 'lineal', 'costo por unidad'], help: 'Precios de referencia auto-calculados: promedio de costo por actividad y precio por unidad ($/pie², $/yarda³...).' },
  { path: '/tech/import', label: 'Importar / Backup', mod: 'tech', section: 'Operaciones', keywords: ['importar', 'backup', 'respaldo', 'exportar', 'copia de seguridad'], help: 'Importación de datos y backup del sistema.' },
  // ── MÓDULO FINANCIERO ──
  { path: '/finance/dashboard', label: 'Dashboard financiero', mod: 'finance', section: 'CFO', keywords: ['finanzas', 'cfo', 'dashboard financiero', 'resumen financiero'], help: 'Tablero del CFO: saldos, ingresos, egresos.' },
  { path: '/finance/movements', label: 'Movimientos', mod: 'finance', section: 'CFO', keywords: ['movimientos', 'transacciones', 'ingreso', 'egreso', 'banco', 'gastos'], help: 'Movimientos bancarios: ingresos, egresos, interbancarios.' },
  { path: '/finance/capital', label: 'Capital', mod: 'finance', section: 'CFO', keywords: ['capital', 'aportes', 'socios', 'equity', 'partners'], help: 'Capital aportado por los socios.' },
  { path: '/finance/debt', label: 'Deuda', mod: 'finance', section: 'CFO', keywords: ['deuda', 'prestamos', 'lender', 'loans', 'interes'], help: 'Préstamos y deuda con lenders.' },
  { path: '/finance/projects', label: 'Proyectos (finanzas)', mod: 'finance', section: 'CFO', keywords: ['proyectos financieros', 'portafolio financiero', 'spv'], help: 'Proyectos del portafolio financiero.' },
  { path: '/finance/accounts', label: 'Cuentas', mod: 'finance', section: 'CFO', keywords: ['cuentas', 'bancos', 'saldos', 'accounts'], help: 'Cuentas bancarias y saldos.' },
  { path: '/finance/statements', label: 'Extractos', mod: 'finance', section: 'CFO', keywords: ['extractos', 'conciliacion', 'statements', 'banco'], help: 'Extractos bancarios y conciliación.' },
  { path: '/finance/cashflow', label: 'Flujo de caja', mod: 'finance', section: 'CFO', keywords: ['flujo de caja', 'cashflow', 'liquidez'], help: 'Dashboard de flujo de caja.' },
  { path: '/finance/liquidity', label: 'Liquidez', mod: 'finance', section: 'CFO', keywords: ['liquidez', 'proyeccion', 'liquidity'], help: 'Proyección de liquidez.' },
  { path: '/finance/reports', label: 'Reportes', mod: 'finance', section: 'CFO', keywords: ['reportes', 'informes', 'reports', 'excel'], help: 'Reportes financieros.' },
  { path: '/finance/returns', label: 'Retornos', mod: 'finance', section: 'CFO', keywords: ['retornos', 'roi', 'rentabilidad', 'returns'], help: 'Retorno por proyecto.' },
  { path: '/finance/catalogs', label: 'Catálogos', mod: 'finance', section: 'CFO', keywords: ['catalogos', 'categorias', 'proveedores financieros', 'origenes'], help: 'Catálogos maestros del módulo financiero.' },
  { path: '/finance/import', label: 'Importar (finanzas)', mod: 'finance', section: 'CFO', keywords: ['importar financiero', 'excel financiero'], help: 'Importación de datos financieros desde Excel.' },
]

function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function scoreEntry(e: Entry, terms: string[]): number {
  const hay = norm(`${e.label} ${e.section} ${e.keywords.join(' ')} ${e.help}`)
  let score = 0
  for (const t of terms) {
    if (!t) continue
    if (norm(e.label).includes(t)) score += 5
    else if (e.keywords.some(k => norm(k).includes(t))) score += 3
    else if (hay.includes(t)) score += 1
  }
  return score
}

export default function AssistantButton() {
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const results = useMemo(() => {
    const terms = norm(query.trim()).split(/\s+/).filter(Boolean)
    if (terms.length === 0) {
      // Sugerencias por defecto: lo más usado.
      const featured = ['/tech/execution', '/tech/draws', '/tech/gantt', '/tech/price-refs', '/tech/tasks', '/tech/alerts', '/finance/movements', '/finance/dashboard']
      return ENTRIES.filter(e => featured.includes(e.path))
    }
    return ENTRIES.map(e => ({ e, s: scoreEntry(e, terms) }))
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 8)
      .map(x => x.e)
  }, [query])

  // No mostrar en la landing (selector de módulos).
  if (location.pathname === '/') return null

  const go = (path: string) => { setOpen(false); setQuery(''); navigate(path) }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Asistente — pregunta o busca en el sistema"
        aria-label="Abrir asistente"
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 px-4 py-3 rounded-full text-white shadow-lg transition-transform hover:scale-105"
        style={{ background: 'linear-gradient(135deg, var(--brand-teal) 0%, var(--brand-gold) 130%)' }}
      >
        <Sparkles className="w-4 h-4" />
        <span className="text-sm font-semibold hidden sm:inline">Asistente</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-black/40" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="¿Qué buscas? Ej: holdback, cronograma, tareas vencidas, precio por pie..."
                className="flex-1 text-sm text-slate-800 focus:outline-none placeholder-slate-400"
                onKeyDown={e => { if (e.key === 'Enter' && results[0]) go(results[0].path) }}
              />
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {query.trim() === '' && (
                <div className="px-4 py-2 text-[11px] text-slate-400 flex items-center gap-1.5">
                  <HelpCircle className="w-3 h-3" /> Sugerencias — o escribe para buscar cualquier sección
                </div>
              )}
              {results.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-slate-400">
                  No encontré esa sección. Prueba con otra palabra (ej. "draws", "gantt", "movimientos").
                </div>
              ) : results.map(e => (
                <button
                  key={e.path}
                  onClick={() => go(e.path)}
                  className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50 text-left transition-colors border-b border-slate-100 last:border-0"
                >
                  <span className={`mt-0.5 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${e.mod === 'tech' ? 'bg-[var(--brand-teal)]/10 text-[var(--brand-teal)]' : 'bg-emerald-100 text-emerald-700'}`}>
                    {e.mod === 'tech' ? 'Téc' : 'Fin'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                      {e.label}
                      <span className="text-[10px] text-slate-400 font-normal">· {e.section}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 leading-snug">{e.help}</div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 flex-shrink-0 mt-1" />
                </button>
              ))}
            </div>
            <div className="px-4 py-2 border-t border-slate-200 text-[10px] text-slate-400">
              Enter para ir al primer resultado · Esc para cerrar
            </div>
          </div>
        </div>
      )}
    </>
  )
}
