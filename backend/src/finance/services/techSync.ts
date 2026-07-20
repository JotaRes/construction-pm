// ============================================================
// ENGRANAJE FINANZAS → OBRA (módulo técnico)
// ============================================================
// Cuando un EGRESO se asocia a una actividad (Item) de un proyecto técnico,
// este servicio registra el gasto en la obra de una de dos formas:
//
//   A) ESPEJO AUTOMÁTICO (techSubAdopted = false): el sistema crea una
//      SubActivity nueva con el valor/fecha/concepto del movimiento y la
//      gestiona por completo (editar el movimiento la actualiza; borrarlo
//      la elimina).
//
//   B) SUBACTIVIDAD ADOPTADA (techSubAdopted = true): el usuario eligió una
//      subactividad YA existente porque el gasto corresponde a ella. El sync
//      solo actualiza su valorEjecutado y fecha (conserva su descripción), y
//      al desvincular o borrar el movimiento NO se elimina — era del usuario.
//
// Reglas de integridad:
//   - Solo los EGRESOS alimentan la obra (un ingreso no es gasto de obra).
//   - NUNCA se eliminan subactividades manuales: solo el espejo automático.
//   - Item.valorEjecutado se recalcula vía recomputeItemExecuted (roll-up
//     estándar del módulo técnico) — misma lógica que una subactividad manual.
import { prisma } from "../../lib/prisma";
import { recomputeItemExecuted } from "../../routes/subactivities";

const MIRROR_PREFIX = "[FIN]";

function mirrorDescription(concept: string): string {
  return `${MIRROR_PREFIX} ${concept}`.slice(0, 300);
}

/** Crea/actualiza/retira el registro en obra según el estado del movimiento. */
export async function syncTechFromMovement(movementId: number): Promise<void> {
  const m = await prisma.finMovement.findUnique({ where: { id: movementId } });
  if (!m) return;

  // Sin vínculo, o dejó de ser egreso → retirar el registro si existía.
  if (m.type !== "Egreso" || !m.techItemId) {
    await unlinkMirror(m.id, m.techSubActivityId, m.techSubAdopted);
    return;
  }

  const item = await prisma.item.findUnique({ where: { id: m.techItemId }, select: { id: true } });
  if (!item) {
    // La actividad ya no existe (obra editada): limpiar vínculo y espejo.
    await unlinkMirror(m.id, m.techSubActivityId, m.techSubAdopted);
    await prisma.finMovement.update({ where: { id: m.id }, data: { techItemId: null } }).catch(() => {});
    return;
  }

  if (m.techSubActivityId) {
    const sub = await prisma.subActivity.findUnique({ where: { id: m.techSubActivityId } });
    if (sub) {
      const previousItemId = sub.itemId;
      if (m.techSubAdopted) {
        // Subactividad del usuario: solo valor y fecha. Su descripción es suya.
        await prisma.subActivity.update({
          where: { id: sub.id },
          data: {
            valorEjecutado: m.amount,
            fecha: m.date,
            observaciones: sub.observaciones?.includes(`movimiento financiero #${m.id}`)
              ? sub.observaciones
              : [sub.observaciones, `Vinculada al movimiento financiero #${m.id}.`].filter(Boolean).join(" · "),
          },
        });
        await recomputeItemExecuted(previousItemId);
        return;
      }
      // Espejo automático: se mueve/actualiza por completo.
      await prisma.subActivity.update({
        where: { id: sub.id },
        data: { itemId: m.techItemId, description: mirrorDescription(m.concept), valorEjecutado: m.amount, fecha: m.date },
      });
      await recomputeItemExecuted(m.techItemId);
      if (previousItemId !== m.techItemId) await recomputeItemExecuted(previousItemId);
      return;
    }
    // La subactividad vinculada fue borrada desde el módulo técnico: se recrea abajo.
  }

  const count = await prisma.subActivity.count({ where: { itemId: m.techItemId } });
  const created = await prisma.subActivity.create({
    data: {
      itemId: m.techItemId,
      description: mirrorDescription(m.concept),
      valorEjecutado: m.amount,
      fecha: m.date,
      order: count,
      observaciones: `Auto — movimiento financiero #${m.id}. Se edita/elimina desde el módulo financiero.`,
    },
  });
  await prisma.finMovement.update({ where: { id: m.id }, data: { techSubActivityId: created.id, techSubAdopted: false } });
  await recomputeItemExecuted(m.techItemId);
}

/** Retira el registro en obra ANTES de borrar el movimiento. */
export async function removeTechForMovement(movementId: number): Promise<void> {
  const m = await prisma.finMovement.findUnique({
    where: { id: movementId },
    select: { id: true, techSubActivityId: true, techSubAdopted: true },
  });
  if (!m) return;
  await unlinkMirror(m.id, m.techSubActivityId, m.techSubAdopted);
}

// Desvincula la subactividad del movimiento. El espejo automático se ELIMINA;
// una subactividad adoptada se CONSERVA (solo se suelta el vínculo).
async function unlinkMirror(movementId: number, techSubActivityId: string | null, adopted: boolean): Promise<void> {
  if (!techSubActivityId) return;
  const sub = await prisma.subActivity.findUnique({ where: { id: techSubActivityId } });
  // Limpiar la referencia primero (FK única) y luego actuar sobre la subactividad.
  await prisma.finMovement.update({
    where: { id: movementId },
    data: { techSubActivityId: null, techSubAdopted: false },
  }).catch(() => {});
  if (!sub) return;
  if (adopted) {
    // Subactividad del usuario: se queda tal cual (con su último valor sincronizado).
    return;
  }
  await prisma.subActivity.delete({ where: { id: sub.id } }).catch(() => {});
  await recomputeItemExecuted(sub.itemId);
}
