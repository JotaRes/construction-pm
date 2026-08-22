import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts': ['recharts'],
          'vendor-query': ['@tanstack/react-query'],
          // Vendors pesados que solo usan páginas puntuales: aislados para que no
          // pesen en el bundle inicial (gantt = vista Gantt, pdf-lib = draws/files).
          'vendor-gantt': ['gantt-task-react'],
          'vendor-pdf': ['pdf-lib'],
          'vendor-dates': ['date-fns'],
        },
      },
    },
  },
})
