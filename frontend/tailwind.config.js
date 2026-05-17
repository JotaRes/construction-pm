/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        // === Tech module (construction-pm) ===
        app: '#0F172A',
        card: '#1E293B',
        input: '#334155',
        // === Finance module ===
        bg: {
          DEFAULT: '#0a0d12',
          soft:    '#11151c',
          card:    '#161b24',
          hover:   '#1c2230',
        },
        line: '#222a37',
        accent: {
          DEFAULT: '#5eead4',
          soft:    '#2dd4bf',
          deep:    '#0d9488',
        },
        positive: '#22c55e',
        negative: '#ef4444',
        warn:     '#f59e0b',
        muted:    '#6b7280',
      },
      boxShadow: {
        card: '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.25)',
      },
    },
  },
  plugins: [],
}
