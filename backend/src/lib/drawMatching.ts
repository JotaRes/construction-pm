// ============================================================
// PARSEO Y MATCHING Draw → Construction Budget (PURO, sin BD)
// ============================================================
// Módulo aislado a propósito: no importa Prisma ni Express, para poder
// testearse de forma directa (scripts/test-draw-matching.ts) y garantizar
// que la sincronización del dinero del lender sea EXACTA.
//
// Caso real que motivó este diseño (proyecto 827, draw 5): Trinity reporta
// "Lumber and materials", "Labor" y "Roofing" al 100%, con "Exterior
// Finishes" como fila de sección en $0. El budget usa guiones ("- Labor") y
// repite "Labor" en varias secciones. El matching debe resolverlo igual que
// un humano: por nombre y POR ORDEN del reporte.

export interface DrawLineApproval {
  itemCode: string
  description: string
  priorAmount: number
  thisInspectionPct: number
  currentAmountAvailable: number
  /** currentAmountAvailable - priorAmount — money approved ONLY in this draw. */
  deltaThisDraw: number
}

// Trinity tiene DOS formatos de Draw Report — el parser soporta ambos.
//
// Formato A (legacy, con itemCode N.N):
//   "21.1 Survey0.64%$3,000.00$0.000%$0.00100%$3,000.00"
//   line# + itemCode + desc + line% + $req + $prior + prior% + $eligible + this% + $current
//
// Formato B (actual 2026, sin itemCode):
//   "2Survey0.53%$2,432.00$0.005%$121.60100%$2,432.00"
//   line# + desc + lineP% + $req + $prior + priorP% + $eligibleThis + thisP% + $current
//
// CRITICAL: las descripciones pueden contener % adentro ("GC Fee — 5% of Total
// Budget"). Anclamos la "cola numérica" (7 grupos al final) y dejamos que la
// descripción sea cualquier cosa (.+? lazy) entre el line# y la cola.
const TRINITY_TAIL = /(\d+\.?\d*)%\$([\d,]+\.\d{2})\$([\d,]+\.\d{2})(\d+(?:\.\d+)?)%\$([\d,]+\.\d{2})(\d+(?:\.\d+)?)%\$([\d,]+\.\d{2})$/
// Formato A: prefijo es lineNum + itemCode N.N + espacio + desc
const TRINITY_ITEM_RE_A = new RegExp(
  `^\\d{1,3}(\\d+\\.\\d+[A-Za-z]?)\\s+(.+?)${TRINITY_TAIL.source}`
)
// Formato B: prefijo es lineNum + desc (cualquier cosa, incluso % adentro)
const TRINITY_ITEM_RE_B = new RegExp(
  `^\\d{1,3}([A-Za-z].+?)${TRINITY_TAIL.source}`
)

export function parseTrinityDrawApprovals(text: string): DrawLineApproval[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\x00/g, '')
  const out: DrawLineApproval[] = []
  for (const ln of normalized.split('\n')) {
    const trimmed = ln.trim()
    if (!trimmed) continue

    // Probar formato A primero (más estricto: tiene itemCode N.N).
    let m = trimmed.match(TRINITY_ITEM_RE_A)
    if (m) {
      const priorAmount = parseFloat(m[5].replace(/,/g, ''))
      const currentAmountAvailable = parseFloat(m[9].replace(/,/g, ''))
      out.push({
        itemCode: m[1],
        description: m[2].trim(),
        priorAmount,
        thisInspectionPct: parseFloat(m[8]),
        currentAmountAvailable,
        deltaThisDraw: Math.max(0, currentAmountAvailable - priorAmount),
      })
      continue
    }

    // Formato B. "Current Amount Available" es lo que Trinity certifica como
    // APROBADO hasta este draw.
    m = trimmed.match(TRINITY_ITEM_RE_B)
    if (m) {
      const description = m[1].trim()
      const priorAmount = parseFloat(m[4].replace(/,/g, ''))
      const currentAmountAvailable = parseFloat(m[8].replace(/,/g, ''))
      out.push({
        itemCode: '',
        description,
        priorAmount,
        thisInspectionPct: parseFloat(m[7]),
        currentAmountAvailable,
        deltaThisDraw: Math.max(0, currentAmountAvailable - priorAmount),
      })
    }
  }
  return out
}

// Normaliza descripción para matching robusto:
//   - lowercase, trim
//   - remueve guiones iniciales ("- Lumber" → "Lumber")
//   - colapsa whitespace, elimina puntuación variable entre fuentes
export function normalizeItemDescription(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/^[-–—\s]+/, '')
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
}

// Tokens significativos de una descripción (para matching difuso).
const STOP_WORDS = new Set(['the', 'and', 'of', 'for', 'de', 'del', 'la', 'el', 'y'])
function descTokens(s: string): Set<string> {
  return new Set(
    normalizeItemDescription(s).split(' ').filter(t => t.length > 1 && !STOP_WORDS.has(t))
  )
}

// Candidatas difusas: califica si (a) el conjunto de tokens más pequeño está
// CONTENIDO en el más grande, o (b) el solape Jaccard ≥ 0.6. Devuelve TODAS
// ordenadas por score — los empates los resuelve la POSICIÓN en el reporte.
export function fuzzyCandidates<T extends { id: string; description: string }>(
  pdfDesc: string,
  lines: T[],
  usedLineIds: Set<string>,
): Array<{ line: T; score: number }> {
  const aTokens = descTokens(pdfDesc)
  if (aTokens.size === 0) return []
  const out: Array<{ line: T; score: number }> = []
  for (const l of lines) {
    if (usedLineIds.has(l.id)) continue
    const bTokens = descTokens(l.description)
    if (bTokens.size === 0) continue
    let inter = 0
    for (const t of aTokens) if (bTokens.has(t)) inter++
    if (inter === 0) continue
    const smaller = Math.min(aTokens.size, bTokens.size)
    const union = aTokens.size + bTokens.size - inter
    const containment = inter / smaller
    const jaccard = inter / union
    if (containment >= 0.999 || jaccard >= 0.6) {
      out.push({ line: l, score: containment + jaccard })
    }
  }
  return out.sort((x, y) => y.score - x.score)
}

// ============================================================
// MATCHING PDF → BUDGET
// ============================================================
// Etapas, en orden de confianza:
//   0. Filas de sección del reporte (todo $0/0%) se saltan — no son ítems.
//   1. itemCode exacto (formato A legacy).
//   2. Descripción normalizada EXACTA; con varias candidatas ("Labor" se
//      repite en Framing, Roofing…), decide la POSICIÓN: Trinity lista en el
//      mismo orden del budget — el "Labor" que sigue a "Lumber" (3.1) es 3.2.
//   3. Difuso por tokens (contención/Jaccard); empates → posición.
export interface ApprovalMatchDecision {
  approval: DrawLineApproval
  lineId: string | null
  lineCode?: string
  lineDesc?: string
  headerRow?: boolean
  stage?: 'code' | 'exact' | 'fuzzy'
}

export function matchApprovalsToLines<L extends { id: string; itemCode: string; description: string }>(
  approvals: DrawLineApproval[],
  lines: L[],
): { decisions: ApprovalMatchDecision[]; unmatched: string[] } {
  const idxOf = new Map(lines.map((l, i) => [l.id, i]))
  const byCode = new Map<string, L>()
  const byDesc = new Map<string, L[]>()
  for (const l of lines) {
    if (l.itemCode) byCode.set(l.itemCode, l)
    const norm = normalizeItemDescription(l.description)
    if (norm) {
      const arr = byDesc.get(norm) ?? []
      arr.push(l)
      byDesc.set(norm, arr)
    }
  }

  const decisions: ApprovalMatchDecision[] = []
  const unmatched: string[] = []
  const usedLineIds = new Set<string>()
  let lastMatchedIdx = -1

  const pickByPosition = (cands: L[]): L => {
    let best = cands[0]
    let bestKey = Number.MAX_SAFE_INTEGER
    for (const c of cands) {
      const i = idxOf.get(c.id) ?? 0
      // adelante del último match = distancia directa; atrás = penalizado (da la vuelta)
      const key = i > lastMatchedIdx ? i - lastMatchedIdx : lines.length + (lastMatchedIdx - i)
      if (key < bestKey) { bestKey = key; best = c }
    }
    return best
  }

  for (const a of approvals) {
    const isHeaderRow = (a.currentAmountAvailable || 0) <= 0 && (a.priorAmount || 0) <= 0 && (a.deltaThisDraw || 0) <= 0
    if (isHeaderRow) {
      decisions.push({ approval: a, lineId: null, headerRow: true })
      continue
    }

    let line: L | undefined = a.itemCode ? byCode.get(a.itemCode) : undefined
    let stage: ApprovalMatchDecision['stage'] = line ? 'code' : undefined

    if (!line) {
      const norm = normalizeItemDescription(a.description)
      const candidates = (norm ? byDesc.get(norm) : undefined)?.filter(c => !usedLineIds.has(c.id)) ?? []
      if (candidates.length === 1) line = candidates[0]
      else if (candidates.length > 1) line = pickByPosition(candidates)
      if (line) stage = 'exact'
    }

    if (!line) {
      const cands = fuzzyCandidates(a.description, lines, usedLineIds)
      if (cands.length === 1) line = cands[0].line
      else if (cands.length > 1) {
        const top = cands.filter(c => cands[0].score - c.score < 0.15).map(c => c.line)
        line = top.length === 1 ? top[0] : pickByPosition(top)
      }
      if (line) stage = 'fuzzy'
    }

    if (!line) {
      unmatched.push(a.itemCode || a.description)
      decisions.push({ approval: a, lineId: null })
      continue
    }
    usedLineIds.add(line.id)
    lastMatchedIdx = idxOf.get(line.id) ?? lastMatchedIdx
    decisions.push({ approval: a, lineId: line.id, lineCode: line.itemCode, lineDesc: line.description, stage })
  }

  return { decisions, unmatched }
}
