// Cliente Prisma UNIFICADO — re-exporta el singleton global del sistema.
// El módulo financiero usa el MISMO cliente que el técnico (un solo pool de
// conexiones Postgres) y accede a los modelos prefijados con `fin`
// (prisma.finAccount, prisma.finMovement, etc.).
export { prisma } from '../../lib/prisma'
