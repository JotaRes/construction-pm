// Donut de progreso SVG — animado con CSS (stroke-dashoffset con transition).
// Usado en Ejecución y Fases para una lectura visual inmediata del avance.
export default function MiniDonut({
  pct,
  size = 52,
  stroke = 6,
  color = '#10b981', // emerald-500 — homogéneo con las barras de progreso
  track = '#e2e8f0', // slate-200
  label,
}: {
  pct: number
  size?: number
  stroke?: number
  color?: string
  track?: string
  label?: string
}) {
  const clamped = Math.max(0, Math.min(100, pct))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - clamped / 100)
  return (
    <div className="relative inline-flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }} title={label ?? `${clamped.toFixed(0)}% completado`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={clamped >= 100 ? '#059669' : color}
          strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
      </svg>
      <span className="absolute font-mono font-bold text-emerald-600" style={{ fontSize: size * 0.24 }}>
        {clamped.toFixed(0)}%
      </span>
    </div>
  )
}
