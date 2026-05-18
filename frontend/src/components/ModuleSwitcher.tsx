import { Link } from 'react-router-dom'
import { Building2, Wallet, ArrowRightLeft } from 'lucide-react'

interface Props {
  currentModule: 'tech' | 'finance'
}

/**
 * Switcher rápido entre módulos — se renderiza en el top bar de cada Layout.
 * En módulo técnico → botón para ir al financiero.
 * En módulo financiero → botón para ir al técnico.
 */
export default function ModuleSwitcher({ currentModule }: Props) {
  const target = currentModule === 'tech' ? 'finance' : 'tech'
  const targetLabel = currentModule === 'tech' ? 'Módulo Financiero' : 'Módulo Técnico'
  const targetIcon = currentModule === 'tech' ? Wallet : Building2

  // Colores adaptados a cada destino
  const isTechTheme = currentModule === 'tech'
  const styles = isTechTheme
    ? {
        // tech → finance (botón con tonos financieros)
        background: 'linear-gradient(135deg, #0F2027 0%, #1B3640 100%)',
        color: '#5eead4',
        iconBg: 'rgba(34,197,94,0.18)',
        hover: 'linear-gradient(135deg, #142d35 0%, #224550 100%)',
      }
    : {
        // finance → tech (botón con tonos técnicos)
        background: 'linear-gradient(135deg, #2D4B52 0%, #3A5F68 100%)',
        color: '#E0AD4F',
        iconBg: 'rgba(200,146,42,0.22)',
        hover: 'linear-gradient(135deg, #355760 0%, #436c77 100%)',
      }

  const Icon = targetIcon

  return (
    <Link
      to={`/${target}`}
      className="group flex items-center gap-2 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all"
      style={{
        background: styles.background,
        color: styles.color,
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = styles.hover)}
      onMouseLeave={e => (e.currentTarget.style.background = styles.background)}
      title={`Ir al ${targetLabel}`}
    >
      <span
        className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ background: styles.iconBg }}
      >
        <Icon size={11} />
      </span>
      <span>Ir a {targetLabel}</span>
      <ArrowRightLeft size={11} className="opacity-70 transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}
