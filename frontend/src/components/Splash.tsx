import { useEffect, useState } from 'react'

export default function Splash() {
  const [out, setOut] = useState(false)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setOut(true), 2100)
    const t2 = setTimeout(() => setGone(true), 2650)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  if (gone) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#0a0c10',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 22,
        opacity: out ? 0 : 1,
        transition: out ? 'opacity 0.55s ease' : 'none',
        pointerEvents: out ? 'none' : 'all',
      }}
    >
      {/* Logo mark — monocromo puro (sistema fijo: sin naranjas, calma) */}
      <div style={{
        width: 56, height: 56, borderRadius: 14,
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.10)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="26" height="24" viewBox="0 0 90 80" fill="none">
          <polygon points="12,74 12,18 41,6 41,74" fill="rgba(255,255,255,0.92)"/>
          <polygon points="46,74 46,28 67,20 67,74" fill="rgba(255,255,255,0.55)"/>
          <path d="M 5,68 Q 42,50 82,61" stroke="#D9AE52"
            strokeWidth="5.5" fill="none" strokeLinecap="round"/>
        </svg>
      </div>

      {/* Brand name */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
          fontSize: 28, fontWeight: 300,
          letterSpacing: '-0.03em',
          color: 'rgba(240,236,228,0.92)',
          lineHeight: 1.1,
        }}>
          Restrepo Acosta
        </div>
        <div style={{
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: 8.5, letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'rgba(240,236,228,0.22)',
          marginTop: 6,
        }}>
          Global Holding LLC
        </div>
      </div>

      {/* Loading bar */}
      <div style={{
        width: 140, height: 1.5,
        background: 'rgba(255,255,255,0.07)',
        borderRadius: 1, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          background: '#D9AE52',
          borderRadius: 1,
          animation: 'ra-splash-load 1.9s ease-in-out forwards',
        }} />
      </div>

      <style>{`
        @keyframes ra-splash-load {
          0%   { width: 0 }
          60%  { width: 72% }
          100% { width: 100% }
        }
      `}</style>
    </div>
  )
}
