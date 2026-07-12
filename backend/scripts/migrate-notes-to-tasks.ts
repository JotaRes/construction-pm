/**
 * Migración one-time: convierte cada Note en una Task de tipo "NOTA".
 * Las Notas quedaron fusionadas dentro de Tareas (una nota es una tarea sin
 * necesidad de completarse, que igual puede llevar fecha y generar alerta).
 *
 * Idempotente: copia cada Note a una Task y luego BORRA la Note, así que
 * re-ejecutarlo no duplica nada (no quedan Notes por migrar).
 *
 * Uso local:  npx tsx scripts/migrate-notes-to-tasks.ts
 * En producción: correr una sola vez tras el deploy que agrega Task.tipo.
 */
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const notes = await prisma.note.findMany({ orderBy: { createdAt: 'asc' } })
  if (notes.length === 0) {
    console.log('No hay notas por migrar. Nada que hacer.')
    return
  }
  let migrated = 0
  for (const n of notes) {
    const count = await prisma.task.count({ where: { projectId: n.projectId } })
    const title = (n.title && n.title.trim())
      || (n.content?.split('\n')[0]?.slice(0, 80).trim())
      || 'Nota'
    await prisma.$transaction([
      prisma.task.create({
        data: {
          projectId: n.projectId,
          tipo: 'NOTA',
          title,
          notes: n.content ?? null,
          priority: 'NORMAL',
          order: count,
          createdAt: n.createdAt,
        },
      }),
      prisma.note.delete({ where: { id: n.id } }),
    ])
    migrated++
  }
  console.log(`Migradas ${migrated} nota(s) a Tareas (tipo=NOTA).`)
}

main()
  .catch(e => { console.error('Error en migración:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
