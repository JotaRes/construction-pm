import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import path from 'path'
import fs from 'fs'
import authRoutes from './routes/auth'
import projectRoutes from './routes/projects'
import phaseRoutes from './routes/phases'
import itemRoutes from './routes/items'
import drawRoutes from './routes/draws'
import providerRoutes from './routes/providers'
import inspectionRoutes from './routes/inspections'
import noteRoutes from './routes/notes'
import fileRoutes from './routes/files'
import alertRoutes from './routes/alerts'
import taskRoutes from './routes/tasks'
import budgetLineRoutes from './routes/budgetLines'
import priceRefRoutes from './routes/priceRefs'
import itemDocumentRoutes from './routes/itemDocuments'
import { seedDatabase } from './seed'
import backupRoutes from './routes/backup'
import downloadRoutes from './routes/download'
import capacityRoutes from './routes/capacity'
import subcontractsRoutes from './routes/subcontracts'
import executiveRoutes from './routes/executive'
import portfolioRoutes from './routes/portfolio'

// === FINANCE MODULE ROUTES ===
import finCatalogs from './finance/routes/catalogs'
import finProjects from './finance/routes/projects'
import finMovements from './finance/routes/movements'
import finAccounts from './finance/routes/accounts'
import finCapital from './finance/routes/capital'
import finLoans from './finance/routes/loans'
import finDashboard from './finance/routes/dashboard'
import finDocuments from './finance/routes/documents'
import finStatements from './finance/routes/statements'
import finImports from './finance/routes/imports'
import finBackup from './finance/routes/backup'
import finReports from './finance/routes/reports'
import finCashflow from './finance/routes/cashflow'
import finProjectReturns from './finance/routes/projectReturns'
import finLiquidity from './finance/routes/liquidity'
import { requireAuth } from './finance/lib/auth'

// Red de seguridad: un archivo corrupto (p.ej. imagen dañada en OCR) puede hacer
// abortar el módulo WASM de tesseract con un error ASÍNCRONO no atrapable por
// try/catch. Estos guards registran el fallo y MANTIENEN el servidor vivo en vez
// de que el proceso muera. No enmascaran datos: el endpoint responde su error.
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException] servidor sobrevive:', err instanceof Error ? err.message : err)
})
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection] servidor sobrevive:', reason instanceof Error ? reason.message : reason)
})

const app = express()
const PORT = process.env.PORT || 3001

// === Trust proxy ===
// Render expone el servicio detrás de exactamente 1 hop de proxy (su load balancer),
// que inyecta el header X-Forwarded-For con la IP real del cliente.
// Con trust proxy = 1, Express lee ese valor correctamente y express-rate-limit
// puede identificar IPs únicas por cliente.
// IMPORTANTE: usar un valor mayor (ej. 2) permitiría a atacantes falsificar su IP
// con un header X-Forwarded-For manipulado y eludir el rate limiting.
// Si en el futuro se agrega Cloudflare o una CDN adicional, cambiar a 2.
app.set('trust proxy', 1)

// ── 1. SECURITY HEADERS (helmet) ─────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc:  ["'self'"],
        scriptSrc:   ["'self'"],
        // style-src incluye fonts.googleapis.com para que el <link rel="stylesheet"> de Google Fonts cargue
        styleSrc:    ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        imgSrc:      ["'self'", 'data:', 'https://res.cloudinary.com'],
        connectSrc:  ["'self'"],
        // font-src incluye fonts.gstatic.com (donde Google sirve los .woff2)
        fontSrc:     ["'self'", 'https://fonts.gstatic.com'],
        objectSrc:   ["'none'"],
        frameSrc:    ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
    xFrameOptions:       { action: 'deny' },
    xContentTypeOptions: true,
    referrerPolicy:      { policy: 'strict-origin-when-cross-origin' },
    crossOriginEmbedderPolicy: false, // No romper carga de recursos externos
  })
)

// ── 2. CORS RESTRICTIVO ───────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://restrepoacosta.onrender.com',
  // Solo en desarrollo local:
  ...(process.env.NODE_ENV !== 'production'
    ? ['http://localhost:5173', 'http://localhost:3001']
    : []),
]

app.use(
  cors({
    origin: (origin, callback) => {
      // Permitir sin origin (same-origin, Postman local)
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error(`CORS bloqueado: ${origin}`))
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)

app.use(express.json())

// ── AUTENTICACIÓN GLOBAL — protege todos los endpoints /api/* ─────────────
// Rutas públicas:
//   - /api/health        → healthcheck de Render
//   - /api/auth/*         → login y verify (necesarias para obtener el token)
//   - /api/download       → proxy de archivos para compartir con terceros
//                           (contratistas/bancos sin sesión). El control de
//                           acceso aquí es la URL impredecible + allowlist de
//                           hosts Cloudinary, NO el token. Protegerla rompería
//                           el compartir por WhatsApp/email.
app.use('/api', (req, res, next) => {
  if (
    req.path === '/health' ||
    req.path.startsWith('/auth/') ||
    req.path.startsWith('/download')
  ) return next()
  return requireAuth(req, res, next)
})

// ── 3. RATE LIMITING — auth endpoints ────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs:              15 * 60 * 1000, // ventana de 15 minutos
  max:                   5,              // máx 5 intentos fallidos por IP
  standardHeaders:       'draft-7',
  legacyHeaders:         false,
  skipSuccessfulRequests: true,          // solo cuenta intentos fallidos
  message:               { error: 'Demasiados intentos. Espera 15 minutos e intenta de nuevo.' },
})
app.use('/api/auth/login', authLimiter)

// API routes
app.use('/api/auth', authRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api/projects', phaseRoutes)
app.use('/api/projects', drawRoutes)
app.use('/api/projects', providerRoutes)
app.use('/api/projects', inspectionRoutes)
app.use('/api/projects', noteRoutes)
app.use('/api/projects', fileRoutes)
app.use('/api/projects', alertRoutes)
app.use('/api/projects', taskRoutes)
app.use('/api/projects', budgetLineRoutes)
app.use('/api/price-refs', priceRefRoutes)
app.use('/api/items', itemDocumentRoutes)
app.use('/api/items', itemRoutes)
app.use('/api/draws', drawRoutes)
app.use('/api/subcontracts', subcontractsRoutes)
app.use('/api/projects', executiveRoutes)
app.use('/api/portfolio', portfolioRoutes)

app.use('/api/backup', backupRoutes)
app.use('/api/download', downloadRoutes)
app.use('/api/system', capacityRoutes)

// === FINANCE MODULE — prefijo /api/finance/* ===
// Auth se comparte con el módulo técnico vía /api/auth (mismo password)
app.use('/api/finance/catalogs', finCatalogs)
app.use('/api/finance/projects', finProjects)
app.use('/api/finance/movements', finMovements)
app.use('/api/finance/accounts', finAccounts)
app.use('/api/finance/capital', finCapital)
app.use('/api/finance/loans', finLoans)
app.use('/api/finance/dashboard', finDashboard)
app.use('/api/finance/documents', finDocuments)
app.use('/api/finance/statements', finStatements)
app.use('/api/finance/imports', finImports)
app.use('/api/finance/backup', finBackup)
app.use('/api/finance/reports', finReports)
app.use('/api/finance/cashflow', finCashflow)
app.use('/api/finance/project-returns', finProjectReturns)
app.use('/api/finance/liquidity-projection', finLiquidity)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: 'v2-with-module-gate' })
})

// Serve React frontend from dist/public (production build)
const frontendPath = path.join(__dirname, '../public')
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath))
  // All non-API routes → React app (client-side routing)
  app.get('/{*path}', (_req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'))
  })
}

;(async () => {
  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient()
  try {
    await seedDatabase(prisma)
  } catch (e) {
    console.error('❌ Seed failed:', e)
  } finally {
    await prisma.$disconnect()
  }
  app.listen(PORT, () => {
    console.log(`Construction PM API running on http://localhost:${PORT}`)
  })
})()

export default app
