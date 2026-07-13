// Auto-diligenciamiento de la sección EJECUCIÓN a partir de documentos del proyecto.
//
// Cuando se sube un HUD de compra del lote, HUD del cierre del préstamo, carta de
// aprobación o LOI, además de poblar el Project se diligencian los ítems de las fases
// correspondientes (F00 Adquisición y Pre-Desarrollo, F01 Financiamiento y Préstamo):
// valor ejecutado, estado HECHO, fecha fin real y el documento como soporte adjunto.
//
// Vive en lib/ (no en una ruta) para poder reutilizarse desde AMBOS puntos de carga:
//   - routes/files.ts        → checklist documental del proyecto (upload directo)
//   - routes/draws.ts        → paneles del módulo Financiero (/docs/parse-pdf)
// Recibe `extracted` (campos resumen) y `lineItems` (desglose de fees por itemCode)
// ya computados por el caller, para no depender de los parsers de draws.ts (evita ciclo).
import { prisma } from './prisma'

export interface ExecTarget {
  itemCode: string     // ítem destino de la fase
  valueField?: string  // campo extraído (monto) → valorEjecutado
  dateField?: string   // campo extraído (fecha ISO) → fechaFinReal
  markDone?: boolean   // marcar el ítem como completado + estado DONE
}

// Mapeo de `kind` documental (llaves del checklist) → ítems de EJECUCIÓN.
// Cada `itemCode` debe existir en la plantilla de fases (data/phasesTemplate.ts).
export const KIND_EXECUTION_MAP: Record<string, ExecTarget[]> = {
  // HUD de compra del lote → F00 Adquisición y Pre-Desarrollo
  hud_lote: [
    { itemCode: '00.01', valueField: 'contractSalesPrice', dateField: 'settlementDate', markDone: true }, // Compra del lote
    { itemCode: '00.02', valueField: 'closingCosts',       dateField: 'settlementDate', markDone: true }, // Closing del lote
  ],
  // HUD de cierre del préstamo → F01 Financiamiento y Préstamo
  hud_cierre: [
    { itemCode: '01.24', valueField: 'cashAtSettlement',   dateField: 'settlementDate', markDone: true }, // Cash at Settlement (equity)
  ],
  // Carta de aprobación / Loan Approval Letter → F01 Financiamiento y Préstamo
  carta_lender: [
    { itemCode: '01.01', dateField: 'settlementDate', markDone: true },       // Solicitud de Construction Loan (implícita)
    { itemCode: '01.02', dateField: 'settlementDate', markDone: true },       // LOI / Loan Approval Letter (el documento en sí)
    { itemCode: '01.10', valueField: 'interestReserve' },                     // Interest Reserve (solo el monto)
  ],
  // LOI del lender → F01 Financiamiento y Préstamo
  loi_lender: [
    { itemCode: '01.01', dateField: 'loiOfferDate', markDone: true },         // Solicitud de Construction Loan (implícita)
    { itemCode: '01.02', dateField: 'loiOfferDate', markDone: true },         // LOI / Loan Approval Letter
  ],
}

// Diligencia los ítems de la sección EJECUCIÓN fusionando dos fuentes:
//   1. KIND_EXECUTION_MAP — hitos documentales y montos resumen (fecha, HECHO, cash
//      at settlement, precio del lote, costos de cierre).
//   2. lineItems — desglose de gastos individuales del HUD (underwriting, title fees,
//      recording, etc.) que el caller asocia a su itemCode de F01.
// Mismo principio que applyExtractedToProject: SÓLO llena casillas vacías (no pisa
// valores curados a mano) y sólo marca HECHO ítems que no estén completados ni en N/A.
// Adjunta el archivo como soporte del ítem (si hay URL) para que no salte la alerta
// "falta factura" cuando se diligenció un valor ejecutado.
export async function applyExtractedToExecution(
  projectId: string,
  kind: string,
  extracted: Record<string, unknown>,
  lineItems: Record<string, number>,
  fileMeta: { url: string | null; name: string },
  // Fees del HUD que NO matchearon el catálogo: se CREAN como actividades
  // nuevas en la fase correspondiente (F01 cierre / F00 lote) para que
  // ningún gasto del documento quede sin contabilizar.
  extraFees: Array<{ label: string; amount: number }> = [],
): Promise<Array<{ itemCode: string; activity: string; applied: string[] }>> {
  const targets = KIND_EXECUTION_MAP[kind] ?? []

  // Los fees de un HUD de CIERRE del préstamo ya fueron pagados en el closing → se
  // marcan HECHO y con fecha de settlement. En una carta/commitment son montos aún
  // COTIZADOS (no pagados) → sólo se carga el valor.
  const feesArePaid = kind === 'hud_cierre'
  const feesDate = feesArePaid && typeof extracted.settlementDate === 'string'
    ? (extracted.settlementDate as string) : undefined

  // Intención combinada por itemCode. El mapa semántico tiene prioridad sobre el valor
  // de línea (no lo pisa) para el mismo ítem (p.ej. 01.10 Interest Reserve).
  const intents = new Map<string, { value?: number; date?: string; markDone?: boolean }>()
  for (const t of targets) {
    const cur = intents.get(t.itemCode) ?? {}
    if (t.valueField && typeof extracted[t.valueField] === 'number') cur.value = extracted[t.valueField] as number
    if (t.dateField && typeof extracted[t.dateField] === 'string') cur.date = extracted[t.dateField] as string
    if (t.markDone) cur.markDone = true
    intents.set(t.itemCode, cur)
  }
  for (const [itemCode, amount] of Object.entries(lineItems)) {
    const cur = intents.get(itemCode) ?? {}
    if (cur.value === undefined) cur.value = amount
    if (cur.date === undefined && feesDate) cur.date = feesDate
    if (cur.markDone === undefined && feesArePaid) cur.markDone = true
    intents.set(itemCode, cur)
  }
  if (intents.size === 0) return []

  const items = await prisma.item.findMany({
    where: { phase: { projectId }, itemCode: { in: [...intents.keys()] } },
    include: { documents: true },
  })
  const byCode = new Map(items.map((i) => [i.itemCode, i]))

  const result: Array<{ itemCode: string; activity: string; applied: string[] }> = []

  // ── Fees no reconocidos → actividades NUEVAS en la fase correspondiente ──
  if (extraFees.length > 0 && (kind === 'hud_cierre' || kind === 'hud_lote')) {
    const phaseCode = kind === 'hud_cierre' ? 'F01' : 'F00'
    const phase = await prisma.phase.findFirst({
      where: { projectId, code: phaseCode },
      include: { items: true },
    })
    if (phase) {
      const existingCodes = phase.items.map((i) => i.itemCode)
      const existingNames = new Set(phase.items.map((i) => i.activity.toLowerCase().trim()))
      let idx = phase.items.length + 1
      for (const fee of extraFees) {
        const nameKey = fee.label.toLowerCase().trim()
        // Idempotencia: si ya existe una actividad con ese nombre, actualizarla (solo si vacía)
        const existing = phase.items.find((i) => i.activity.toLowerCase().trim() === nameKey)
        if (existing) {
          if (!existing.valorEjecutado || existing.valorEjecutado === 0) {
            await prisma.item.update({
              where: { id: existing.id },
              data: { valorEjecutado: fee.amount, ...(feesArePaid ? { completado: true, estado: 'DONE' } : {}), ...(feesDate ? { fechaFinReal: new Date(feesDate) } : {}) },
            })
            result.push({ itemCode: existing.itemCode, activity: existing.activity, applied: ['valor ejecutado (fee del HUD)'] })
          }
          continue
        }
        if (existingNames.has(nameKey)) continue
        let newCode = `${phaseCode.replace('F', '')}.A${String(idx).padStart(2, '0')}`
        while (existingCodes.includes(newCode)) { idx++; newCode = `${phaseCode.replace('F', '')}.A${String(idx).padStart(2, '0')}` }
        existingCodes.push(newCode)
        existingNames.add(nameKey)
        idx++
        const created = await prisma.item.create({
          data: {
            phaseId: phase.id,
            itemCode: newCode,
            activity: fee.label,
            description: `Creado automáticamente desde el HUD (${fileMeta.name})`,
            unit: 'LS',
            valorPresupuestado: 0,
            valorEjecutado: fee.amount,
            ...(feesArePaid ? { completado: true, estado: 'DONE' } : {}),
            ...(feesDate ? { fechaFinReal: new Date(feesDate) } : {}),
            order: phase.items.length + idx,
          },
        })
        if (fileMeta.url) {
          await prisma.itemDocument.create({
            data: {
              itemId: created.id,
              type: 'FACTURA',
              name: fileMeta.name,
              amount: fee.amount,
              fileUrl: fileMeta.url,
              notes: 'Fee del HUD no catalogado — actividad creada automáticamente',
            },
          })
        }
        result.push({ itemCode: newCode, activity: fee.label, applied: ['actividad creada', 'valor ejecutado', 'soporte adjunto'] })
      }
    }
  }

  for (const [itemCode, intent] of intents) {
    const item = byCode.get(itemCode)
    if (!item) continue
    const data: Record<string, unknown> = {}
    const applied: string[] = []

    // Valor ejecutado — sólo si el ítem está vacío
    if (typeof intent.value === 'number' && intent.value > 0 && (!item.valorEjecutado || item.valorEjecutado === 0)) {
      data.valorEjecutado = intent.value
      applied.push('valor ejecutado')
    }
    // Fecha fin real — sólo si está vacía (las fechas extraídas ya vienen en ISO)
    if (intent.date && !item.fechaFinReal) {
      const dt = new Date(intent.date)
      if (!isNaN(dt.getTime())) { data.fechaFinReal = dt; applied.push('fecha') }
    }
    // Marcar HECHO — sólo si no está completado ni marcado N/A
    if (intent.markDone && !item.completado && !item.esNA) {
      data.completado = true
      data.estado = 'DONE'
      applied.push('estado: hecho')
    }

    if (applied.length === 0) continue
    await prisma.item.update({ where: { id: item.id }, data })

    // Adjuntar el documento como soporte del ítem (si hay archivo y aún no está adjunto).
    const alreadyAttached = fileMeta.url ? item.documents.some((doc) => doc.fileUrl === fileMeta.url) : true
    if (fileMeta.url && !alreadyAttached) {
      const hasValue = typeof data.valorEjecutado === 'number'
      await prisma.itemDocument.create({
        data: {
          itemId: item.id,
          type: hasValue ? 'FACTURA' : 'OTRO',
          name: fileMeta.name,
          vendor: typeof extracted.lender === 'string' ? (extracted.lender as string) : null,
          amount: hasValue ? (data.valorEjecutado as number) : null,
          fileUrl: fileMeta.url,
          notes: `Auto-adjuntado desde el documento "${kind}"`,
        },
      })
      applied.push('soporte adjunto')
    }

    result.push({ itemCode: item.itemCode, activity: item.activity, applied })
  }

  return result
}
