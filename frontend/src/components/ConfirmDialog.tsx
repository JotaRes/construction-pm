/**
 * ConfirmDialog — reemplaza `confirm()` nativo del browser por un modal
 * con la paleta brand. Más profesional y consistente con el resto del UI.
 *
 * Uso vía hook:
 *   const confirm = useConfirm()
 *   const ok = await confirm({
 *     title: 'Eliminar movimiento',
 *     message: '¿Seguro que quieres eliminar este movimiento? Esta acción no se puede deshacer.',
 *     confirmText: 'Sí, eliminar',
 *     destructive: true,
 *   })
 *   if (ok) doDelete()
 */
import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { AlertTriangle, X, Trash2, CheckCircle2 } from 'lucide-react'

export interface ConfirmOptions {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  destructive?: boolean
  // Si se pasa, el usuario debe escribir esta palabra para confirmar (ej. "BORRAR")
  typeToConfirm?: string
  // Texto adicional (lista de items afectados, advertencia extra, etc.)
  detail?: string
}

type Resolver = (value: boolean) => void

const ConfirmContext = createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const [resolver, setResolver] = useState<Resolver | null>(null)
  const [typedValue, setTypedValue] = useState('')

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    setOpts(options)
    setTypedValue('')
    return new Promise<boolean>((resolve) => setResolver(() => resolve))
  }, [])

  const close = (result: boolean) => {
    if (resolver) resolver(result)
    setOpts(null)
    setResolver(null)
    setTypedValue('')
  }

  const isDestructive = !!opts?.destructive
  const needsType = !!opts?.typeToConfirm
  const canConfirm = !needsType || typedValue === opts?.typeToConfirm

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4"
          onClick={() => close(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
            style={{ border: '1px solid rgba(29,29,31,0.15)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header con barra de color según tipo */}
            <div
              className="h-1.5"
              style={{
                background: isDestructive
                  ? 'linear-gradient(90deg, #dc2626 0%, #f87171 100%)'
                  : 'linear-gradient(90deg, var(--brand-teal) 0%, var(--brand-gold) 100%)',
              }}
            />

            <div className="px-6 py-5">
              {/* Icon + título */}
              <div className="flex items-start gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    background: isDestructive ? 'rgba(220,38,38,0.1)' : 'rgba(62,90,112,0.12)',
                    color: isDestructive ? '#dc2626' : 'var(--brand-gold)',
                  }}
                >
                  {isDestructive ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <h3
                    className="text-base font-bold"
                    style={{ color: 'var(--brand-teal)' }}
                  >
                    {opts.title}
                  </h3>
                </div>
                <button
                  onClick={() => close(false)}
                  className="p-1 -m-1 rounded-lg hover:bg-stone-100 transition-colors flex-shrink-0"
                  style={{ color: 'var(--brand-teal2)' }}
                  aria-label="Cerrar"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Mensaje */}
              <p className="text-sm mb-3 leading-relaxed" style={{ color: 'var(--brand-teal)' }}>
                {opts.message}
              </p>

              {/* Detalle adicional (lista, warning extra) */}
              {opts.detail && (
                <div
                  className="text-xs p-3 rounded-lg mb-3"
                  style={{
                    background: isDestructive ? 'rgba(220,38,38,0.05)' : 'var(--brand-cream2)',
                    color: 'var(--brand-teal2)',
                    border: `1px solid ${isDestructive ? 'rgba(220,38,38,0.15)' : 'rgba(29,29,31,0.08)'}`,
                  }}
                >
                  {opts.detail}
                </div>
              )}

              {/* Type to confirm */}
              {needsType && (
                <div className="mb-3">
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--brand-teal)' }}>
                    Escribe <span className="font-mono px-1.5 py-0.5 rounded bg-red-50 text-red-700">{opts.typeToConfirm}</span> para confirmar:
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={typedValue}
                    onChange={(e) => setTypedValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && canConfirm) close(true) }}
                    className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none"
                    style={{
                      borderColor: 'rgba(29,29,31,0.2)',
                      fontFamily: 'monospace',
                    }}
                    placeholder={opts.typeToConfirm}
                  />
                </div>
              )}

              {/* Botones */}
              <div className="flex justify-end gap-2 pt-3" style={{ borderTop: '1px solid rgba(29,29,31,0.08)' }}>
                <button
                  onClick={() => close(false)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                  style={{
                    color: 'var(--brand-teal)',
                    background: 'transparent',
                    border: '1px solid rgba(29,29,31,0.15)',
                  }}
                >
                  {opts.cancelText || 'Cancelar'}
                </button>
                <button
                  onClick={() => close(true)}
                  disabled={!canConfirm}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white inline-flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: isDestructive
                      ? 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)'
                      : 'linear-gradient(135deg, var(--brand-gold) 0%, var(--brand-gold2) 100%)',
                    boxShadow: isDestructive ? '0 4px 14px rgba(220,38,38,0.25)' : '0 4px 14px rgba(62,90,112,0.25)',
                  }}
                  autoFocus={!needsType}
                >
                  {isDestructive && <Trash2 size={14} />}
                  {opts.confirmText || (isDestructive ? 'Eliminar' : 'Confirmar')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

/**
 * Hook para invocar el confirm modal. Retorna una promise<boolean>.
 * Si el ConfirmProvider no está montado, hace fallback a window.confirm().
 */
export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  return ctx || (async (opts: ConfirmOptions) => window.confirm(`${opts.title}\n\n${opts.message}`))
}
