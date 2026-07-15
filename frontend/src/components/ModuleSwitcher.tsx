import { Link } from 'react-router-dom'
import { Building2, Wallet, Landmark, ArrowRightLeft } from 'lucide-react'

type ModuleName = 'tech' | 'finance' | 'admin'

interface Props {
  currentModule: ModuleName
}

// Identidad visual de cada módulo (destino del botón)
const MODULES: Record<ModuleName, {
  label: string
  icon: typeof Building2
  background: string
  color: string
  iconBg: string
  hover: string
}> = {
  tech: {
    label: 'Técnico',
    icon: Building2,
    background: 'linear-gradient(135deg, #2D4B52 0%, #3A5F68 100%)',
    color: '#E0AD4F',
    iconBg: 'rgba(200,146,42,0.22)',
    hover: 'linear-gradient(135deg, #355760 0%, #436c77 100%)',
  },
  finance: {
    label: 'Financiero',
    icon: Wallet,
    background: 'linear-gradient(135deg, #0F2027 0%, #1B3640 100%)',
    color: '#5eead4',
    iconBg: 'rgba(34,197,94,0.18)',
    hover: 'linear-gradient(135deg, #142d35 0%, #224550 100%)',
  },
  admin: {
    label: 'Administrativo',
    icon: Landmark,
    background: 'linear-gradient(135deg, #2A1E3F 0%, #3E2C5C 100%)',
    color: '#c4b5fd',
    iconBg: 'rgba(139,92,246,0.22)',
    hover: 'linear-gradient(135deg, #342650 0%, #4a366d 100%)',
  },
}

/**
 * Switcher rápido entre módulos — se renderiza en el top bar de cada Layout.
 * Muestra un botón hacia cada uno de los OTROS dos módulos del ecosistema.
 */
export default function ModuleSwitcher({ currentModule }: Props) {
  const targets = (Object.keys(MODULES) as ModuleName[]).filter((m) => m !== currentModule)

  return (
    <div className="flex items-center gap-2">
      {targets.map((target) => {
        const styles = MODULES[target]
        const Icon = styles.icon
        return (
          <Link
            key={target}
            to={`/${target}`}
            className="group flex items-center gap-2 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all"
            style={{
              background: styles.background,
              color: styles.color,
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = styles.hover)}
            onMouseLeave={e => (e.currentTarget.style.background = styles.background)}
            title={`Ir al Módulo ${styles.label}`}
          >
            <span
              className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
              style={{ background: styles.iconBg }}
            >
              <Icon size={11} />
            </span>
            <span className="hidden lg:inline">{styles.label}</span>
            <ArrowRightLeft size={11} className="opacity-70 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )
      })}
    </div>
  )
}
