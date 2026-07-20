// ============================================================
// ENGRANAJE FINANZAS → OBRA (módulo técnico)
// ============================================================
// Cuando un EGRESO se asocia a una actividad (Item) de un proyecto técnico,
// este servicio crea/actualiza una SubActivity "espejo" en esa actividad con
// el mismo valor, fecha y concepto. Así el gasto queda registrado en ambos
// módulos de una sola vez, con trazabilidad bidireccional:
//   FinMovement.techItemId        → actividad de obra elegida
//   FinMovement.techSubActivityId → subactividad espejo (gestión automática)
//
// Reglas de integridad:
//   - Solo los EGRESOS alimentan la obra (un ingreso no es gasto de obra).
//   - El espejo se recalcula al editar el movimiento (monto, fecha, concepto,
//     actividad) y se elimina al borrar el movimiento o quitar el vínculo.
//   - NUNCA se tocan subactividades creadas manualmente por el usuario: solo
//     la subactividad cuyo id vive en techSubActivityId.
//   - Item.valorEjecutado se recalcula vía recomputeItemExecuted (roll-up
//     estándar del módulo técnico) — misma lógica que una subactividad manual.
import { prisma } from "../../lib/prisma";
import { recomputeItemExecuted } from "../../routes/subactivities";

const MIRROR_PREFIX = "[FIN]";

function mirrorDescription(concept: string): string {
  return `${MIRROR_PREFIX} ${concept}`.slice(0, 300);
}

/** Crea/actualiza/retira la subactividad espejo según el estado del movimiento. */
export async function syncTechFromMovement(movementId: number): Promise<void> {
  const m = await prisma.finMovement.findUnique({ where: { id: movementId } });
  if (!m) return;

  // Sin vínculo, o dejó de ser egreso → retirar el espejo si existía.
  if (m.type !== "Egreso" || !m.techItemId) {
    await removeMirror(m.id, m.techSubActivityId);
    return;
  }

  const item = await prisma.item.findUnique({ where: { id: m.techItemId }, select: { id: true } });
  if (!item) {
    // La actividad ya no existe (obra editada): limpiar vínculo y espejo.
    await removeMirror(m.id, m.techSubActivityId);
    await prisma.finMovement.update({ where: { id: m.id }, data: { techItemId: null } }).catch(() => {});
    return;
  }

  const data = {
    description: mirrorDescription(m.concept),
    valorEjecutado: m.amount,
    fecha: m.date,
  };

  if (m.techSubActivityId) {
    const sub = await prisma.subActivity.findUnique({ where: { id: m.techSubActivityId } });
    if (sub) {
      const previousItemId = sub.itemId;
      await prisma.subActivity.update({
        where: { id: sub.id },
        data: { ...data, itemId: m.techItemId },
      });
      await recomputeItemExecuted(m.techItemId);
      if (previousItemId !== m.techItemId) await recomputeItemExecuted(previousItemId);
      return;
    }
    // El espejo fue borrado desde el módulo técnico: se recrea abajo.
  }

  const count = await prisma.subActivity.count({ where: { itemId: m.techItemId } });
  const created = await prisma.subActivity.create({
    data: {
      itemId: m.techItemId,
      ...data,
      order: count,
      observaciones: `Auto — movimiento financiero #${m.id}. Se edita/elimina desde el módulo financiero.`,
    },
  });
  await prisma.finMovement.update({ where: { id: m.id }, data: { techSubActivityId: created.id } });
  await recomputeItemExecuted(m.techItemId);
}

/** Elimina la subactividad espejo ANTES de borrar el movimiento. */
export async function removeTechForMovement(movementId: number): Promise<void> {
  const m = await prisma.finMovement.findUnique({
    where: { id: movementId },
    select: { id: true, techSubActivityId: true },
  });
  if (!m) return;
  await removeMirror(m.id, m.techSubActivityId);
}

async function removeMirror(movementId: number, techSubActivityId: string | null): Promise<void> {
  if (!techSubActivityId) return;
  const sub = await prisma.subActivity.findUnique({ where: { id: techSubActivityId } });
  // Limpiar la referencia primero (FK) y luego borrar el espejo + roll-up.
  await prisma.finMovement.update({ where: { id: movementId }, data: { techSubActivityId: null } }).catch(() => {});
  if (sub) {
    await prisma.subActivity.delete({ where: { id: sub.id } }).catch(() => {});
    await recomputeItemExecuted(sub.itemId);
  }
}
