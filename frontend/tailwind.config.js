/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['"DM Serif Display"', 'Georgia', 'serif'],
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
      colors: {
        // ── Tech module legacy ──
        app:  '#0F172A',
        card: '#1E293B',
        input:'#334155',
        // ── Teal palette completa ──
        teal: {
          0: '#081419', 1: '#0F2027', 2: '#1A3035', 3: '#253D44',
          DEFAULT: '#2D4B52',
          5: '#3A5F68', 6: '#4A7A84', 7: '#7AABB5', 8: '#C0DCE2', 9: '#E8F2F4',
        },
        // ── Gold palette completa ──
        gold: {
          1: '#8A6010', 2: '#C8922A', DEFAULT: '#C8922A',
          3: '#D9A440', 4: '#E0AD4F', 5: '#ECC97A', 6: '#F5E4BA',
        },
        // ── Cream palette ──
        cream: {
          1: '#D8D2CB', DEFAULT: '#EAE5DF',
          3: '#F4F0EB', 4: '#FDFCFA',
        },
        // ── Semánticos ──
        positive: '#059669',
        negative: '#DC2626',
        warn:     '#D97706',
        muted:    '#6B7280',
        // ── Finance dark mode (legacy — override by CSS) ──
        bg: { DEFAULT: '#0a0d12', soft: '#11151c', card: '#161b24', hover: '#1c2230' },
        line: '#222a37',
        accent: { DEFAULT: '#5eead4', soft: '#2dd4bf', deep: '#0d9488' },
      },
      fontSize: {
        'kpi-sm': ['clamp(1.5rem,2.8vw,2rem)',    { lineHeight:'1', fontWeight:'700', letterSpacing:'-0.02em' }],
        'kpi-md': ['clamp(1.8rem,3.5vw,2.4rem)',  { lineHeight:'1', fontWeight:'700', letterSpacing:'-0.025em' }],
        'kpi-lg': ['clamp(2.2rem,4vw,3rem)',      { lineHeight:'1', fontWeight:'700', letterSpacing:'-0.03em' }],
        'kpi-xl': ['clamp(2.8rem,5vw,3.8rem)',    { lineHeight:'1', fontWeight:'700', letterSpacing:'-0.035em' }],
      },
      boxShadow: {
        'card':       '0 1px 0 rgba(255,255,255,0.92) inset, 0 2px 8px rgba(13,26,29,0.08), 0 12px 28px rgba(13,26,29,0.05)',
        'card-hover': '0 1px 0 rgba(255,255,255,0.96) inset, 0 4px 16px rgba(13,26,29,0.11), 0 24px 52px rgba(13,26,29,0.07)',
        'card-gold':  '0 1px 0 rgba(255,255,255,0.92) inset, 0 4px 20px rgba(200,146,42,0.15)',
        'btn':        '0 1px 3px rgba(13,26,29,0.07), 0 1px 0 rgba(255,255,255,0.92) inset',
        'btn-gold':   '0 2px 6px rgba(200,146,42,0.18), 0 8px 28px rgba(200,146,42,0.30)',
        'btn-teal':   '0 2px 6px rgba(45,75,82,0.22), 0 8px 24px rgba(45,75,82,0.26)',
        'sidebar':    '6px 0 40px rgba(0,0,0,0.20)',
        'input-focus':'0 0 0 3px rgba(200,146,42,0.18), 0 1px 3px rgba(13,26,29,0.10)',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      animation: {
        'fade-up':   'fadeUp 0.28s cubic-bezier(0.4,0,0.2,1) both',
        'fade-in':   'fadeIn 0.2s ease both',
        'count-up':  'countUp 0.5s cubic-bezier(0.4,0,0.2,1) both',
        'badge-in':  'badgeIn 0.2s cubic-bezier(0.175,0.885,0.32,1.275) both',
        'shimmer':   'shimmer 2.2s linear infinite',
        'pulse-red': 'pulseRed 2.5s ease infinite',
      },
      keyframes: {
        fadeUp:    { from:{opacity:'0',transform:'translateY(10px)'}, to:{opacity:'1',transform:'translateY(0)'} },
        fadeIn:    { from:{opacity:'0'},                              to:{opacity:'1'} },
        countUp:   { from:{opacity:'0',transform:'translateY(7px) scale(0.93)'}, to:{opacity:'1',transform:'translateY(0) scale(1)'} },
        badgeIn:   { from:{opacity:'0',transform:'scale(0.72)'},      to:{opacity:'1',transform:'scale(1)'} },
        shimmer:   { '0%':{backgroundPosition:'200% center'},         '100%':{backgroundPosition:'-200% center'} },
        pulseRed:  { '0%,100%':{boxShadow:'0 0 0 0 rgba(220,38,38,.3)'}, '60%':{boxShadow:'0 0 0 5px rgba(220,38,38,0)'} },
      },
    },
  },
  plugins: [],
}
