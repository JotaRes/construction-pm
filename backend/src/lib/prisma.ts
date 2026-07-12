// ============================================================
// CLIENTE PRISMA ÚNICO PARA TODO EL SISTEMA (tech + finance)
// ============================================================
// Antes existían 21 instancias de `new PrismaClient()` (una por archivo de
// rutas). En SQLite era inocuo; en PostgreSQL cada instancia abre su propio
// pool de conexiones y el Postgres de Render tiene límite (~97 conexiones):
// múltiples pools = riesgo real de "too many connections" en producción.
//
// REGLA: ningún archivo debe hacer `new PrismaClient()`. Importar siempre:
//   import { prisma } from '../lib/prisma'   (desde src/routes/*)
//   import { prisma } from './lib/prisma'    (desde src/*)
// El módulo finance re-exporta este mismo cliente desde finance/lib/prisma.ts.
import { PrismaClient } from '@prisma/client'

declare global {
  // eslint-disable-next-line no-var
  var __prismaShared: PrismaClient | undefined
}

export const prisma =
  global.__prismaShared ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
  })

// En dev (tsx watch) evita crear un cliente nuevo en cada hot-reload.
if (process.env.NODE_ENV !== 'production') global.__prismaShared = prisma
