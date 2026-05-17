import { prisma } from "../lib/prisma";

// Detecta pares de movimientos que son transferencias internas:
//   - tipo "Interbancario" (ya marcados como tales)
//   - o mismo monto exacto + fecha dentro de ±3 días + entre cuentas distintas
//     donde uno es Egreso y otro Ingreso, y no estén ya vinculados.

export async function detectIntercompany(): Promise<{ linked: number; alreadyLinked: number; candidates: number }> {
  const movements = await prisma.movement.findMany({
    where: { isIntercompany: false },
    orderBy: { date: "asc" },
  });

  const byAmount = new Map<number, typeof movements>();
  for (const m of movements) {
    const k = Math.round(m.amount * 100);
    if (!byAmount.has(k)) byAmount.set(k, []);
    byAmount.get(k)!.push(m);
  }

  let linked = 0;
  const used = new Set<number>();

  for (const [, group] of byAmount) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      const a = group[i];
      if (used.has(a.id)) continue;
      for (let j = i + 1; j < group.length; j++) {
        const b = group[j];
        if (used.has(b.id)) continue;
        if (a.accountId === b.accountId) continue;
        const aIsOut = a.type === "Egreso" || a.type === "Interbancario";
        const bIsIn = b.type === "Ingreso" || b.type === "Interbancario";
        const aIsIn = a.type === "Ingreso" || a.type === "Interbancario";
        const bIsOut = b.type === "Egreso" || b.type === "Interbancario";
        const opposite = (aIsOut && bIsIn) || (aIsIn && bIsOut);
        if (!opposite) continue;
        const days = Math.abs((a.date.getTime() - b.date.getTime()) / 86400000);
        if (days > 3) continue;
        // Match!
        await prisma.$transaction([
          prisma.movement.update({ where: { id: a.id }, data: { isIntercompany: true, linkedMovementId: b.id } }),
          prisma.movement.update({ where: { id: b.id }, data: { isIntercompany: true } }),
        ]);
        used.add(a.id);
        used.add(b.id);
        linked++;
        break;
      }
    }
  }

  const alreadyLinked = await prisma.movement.count({ where: { isIntercompany: true } });
  return { linked, alreadyLinked, candidates: movements.length };
}
