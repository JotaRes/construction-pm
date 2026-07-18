import type { LucideIcon } from 'lucide-react'

/**
 * Encabezado estándar de módulo — "Ledger & Blueprint".
 * Icono enmarcado en cobalto + título serif + subtítulo + regla de plano.
 * Úsalo en TODAS las páginas para identidad visual consistente.
 */
export default function PageHeader({ icon: Icon, title, subtitle, children }: {
  icon: LucideIcon
  title: string
  subtitle?: string
  children?: React.ReactNode // acciones a la derecha (botones, filtros)
}) {
  return (
    <div>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="page-head">
          <div className="page-head-icon">
            <Icon className="w-[22px] h-[22px]" strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="page-head-title">{title}</h1>
            {subtitle && <p className="page-head-sub">{subtitle}</p>}
          </div>
        </div>
        {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
      </div>
      <div className="page-head-rule" />
    </div>
  )
}
