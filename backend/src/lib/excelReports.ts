// ============================================================
// excelReports.ts — Generadores de reportes Excel "plan B de control"
// ------------------------------------------------------------
// Dos workbooks profesionales construidos con ExcelJS:
//   - buildTechExcel(data)    → Reporte del módulo TÉCNICO (obra)
//   - buildFinanceExcel(snap) → Reporte del módulo FINANCIERO (CFO)
//
// Cada workbook abre con una hoja "Dashboard" (KPIs + barras de datos)
// y luego una pestaña por tema, con formato monetario, totales y bandas
// de color, pensado para que cualquier persona lo entienda sin contexto.
// No depende de Prisma: recibe los datos ya consultados.
// ============================================================
import ExcelJS from 'exceljs'

// ── Paleta de marca ───────────────────────────────────────────
const NAVY = 'FF1F2A44' // azul corporativo (cabeceras)
const GOLD = 'FFB8893A' // dorado premium (acentos)
const CREAM = 'FFF7F4EC' // banda clara alterna
const WHITE = 'FFFFFFFF'
const INK = 'FF1F2A44'
const GREY = 'FF6B7280'
const GREEN = 'FF2E7D5B'
const RED = 'FFB23A3A'
const CARD_BG = 'FFF1ECE0'

// ── Formatos numéricos ────────────────────────────────────────
const MONEY = '"$"#,##0.00'
const MONEY0 = '"$"#,##0'
const PCT = '0.0%'
const INT = '#,##0'

const THIN = 'thin' as const
const BORDER_GREY = { style: THIN, color: { argb: 'FFD9D2C4' } }

type Col = {
  header: string
  key: string
  width?: number
  numFmt?: string
  dataBar?: boolean // pinta barras de datos en la columna (visual)
  total?: boolean // suma en fila de totales
  wrap?: boolean
}

// Convierte cualquier valor a algo que ExcelJS escriba bien.
function cellVal(v: unknown): any {
  if (v === null || v === undefined) return null
  if (v instanceof Date) return v
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  if (typeof v === 'object') {
    const o = v as any
    return o.name ?? o.fullName ?? o.code ?? JSON.stringify(o)
  }
  return v
}

function colLetter(n: number): string {
  let s = ''
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

// ── Hoja-tabla estándar con cabecera estilizada, bandas y totales ──
function addTableSheet(
  wb: ExcelJS.Workbook,
  opts: { name: string; title: string; subtitle?: string; columns: Col[]; rows: any[]; accent?: string }
) {
  const { name, title, columns, rows } = opts
  const accent = opts.accent ?? NAVY
  const ws = wb.addWorksheet(name.slice(0, 31), {
    views: [{ state: 'frozen', ySplit: 3 }],
    properties: { defaultRowHeight: 16 },
  })
  const nCols = columns.length

  // Título (fila 1)
  ws.mergeCells(1, 1, 1, nCols)
  const tCell = ws.getCell(1, 1)
  tCell.value = title
  tCell.font = { name: 'Calibri', size: 15, bold: true, color: { argb: WHITE } }
  tCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: accent } }
  tCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  ws.getRow(1).height = 26

  // Subtítulo (fila 2)
  ws.mergeCells(2, 1, 2, nCols)
  const sCell = ws.getCell(2, 1)
  sCell.value = opts.subtitle ?? `${rows.length} registro(s) · generado ${new Date().toLocaleString('es-CO')}`
  sCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: GREY } }
  sCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  ws.getRow(2).height = 16

  // Cabecera de columnas (fila 3)
  const headerRow = ws.getRow(3)
  columns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = c.header
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: WHITE } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GOLD } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = { top: BORDER_GREY, bottom: BORDER_GREY, left: BORDER_GREY, right: BORDER_GREY }
  })
  headerRow.height = 22
  ws.columns.forEach((col, i) => {
    col.width = columns[i]?.width ?? 16
  })

  // Filas de datos (desde fila 4)
  rows.forEach((r, idx) => {
    const excelRow = ws.getRow(4 + idx)
    columns.forEach((c, i) => {
      const cell = excelRow.getCell(i + 1)
      cell.value = cellVal(r[c.key])
      if (c.numFmt) cell.numFmt = c.numFmt
      cell.font = { name: 'Calibri', size: 10, color: { argb: INK } }
      cell.alignment = { vertical: 'middle', horizontal: c.numFmt ? 'right' : 'left', wrapText: !!c.wrap, indent: c.numFmt ? 0 : 1 }
      if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CREAM } }
      cell.border = { bottom: BORDER_GREY }
    })
  })

  // Fila de totales
  const totalCols = columns.map((c, i) => ({ c, i })).filter((x) => x.c.total)
  if (totalCols.length && rows.length) {
    const totRow = ws.getRow(4 + rows.length)
    const first = totRow.getCell(1)
    first.value = 'TOTAL'
    first.font = { name: 'Calibri', size: 10, bold: true, color: { argb: WHITE } }
    first.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
    first.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
    for (let i = 1; i < nCols; i++) {
      const cell = totRow.getCell(i + 1)
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
      const isTotal = totalCols.some((x) => x.i === i)
      if (isTotal) {
        const sum = rows.reduce((s, r) => s + (Number(r[columns[i].key]) || 0), 0)
        cell.value = sum
        cell.numFmt = columns[i].numFmt ?? INT
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: WHITE } }
        cell.alignment = { vertical: 'middle', horizontal: 'right' }
      }
    }
    totRow.height = 20
  }

  // Barras de datos (conditional formatting) en columnas marcadas
  if (rows.length) {
    columns.forEach((c, i) => {
      if (!c.dataBar) return
      const letter = colLetter(i + 1)
      const ref = `${letter}4:${letter}${3 + rows.length}`
      ws.addConditionalFormatting({
        ref,
        rules: [
          {
            type: 'dataBar',
            cfvo: [{ type: 'min' }, { type: 'max' }],
            color: { argb: GOLD },
            priority: 1,
          } as any,
        ],
      })
    })
  }

  // Autofiltro sobre la cabecera
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: nCols } }
  return ws
}

// ── Hoja Dashboard: tarjetas KPI + tabla resumen con barras ──────
function addDashboard(
  wb: ExcelJS.Workbook,
  opts: {
    title: string
    subtitle: string
    kpis: Array<{ label: string; value: number | string; numFmt?: string; accent?: string }>
    summary?: { title: string; columns: Col[]; rows: any[] }
  }
) {
  const ws = wb.addWorksheet('Dashboard', { views: [{ showGridLines: false }] })
  // Anchos base (12 columnas de trabajo)
  for (let i = 1; i <= 12; i++) ws.getColumn(i).width = 12

  // Banner
  ws.mergeCells(1, 1, 1, 12)
  const t = ws.getCell(1, 1)
  t.value = opts.title
  t.font = { name: 'Calibri', size: 20, bold: true, color: { argb: WHITE } }
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
  t.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  ws.getRow(1).height = 38

  ws.mergeCells(2, 1, 2, 12)
  const s = ws.getCell(2, 1)
  s.value = opts.subtitle
  s.font = { name: 'Calibri', size: 10, italic: true, color: { argb: GREY } }
  s.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CREAM } }
  s.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  ws.getRow(2).height = 20

  // Tarjetas KPI — 4 por fila, cada tarjeta ocupa 3 columnas y 3 filas
  let row = 4
  let col = 1
  const cardW = 3
  const cardH = 3
  opts.kpis.forEach((k, idx) => {
    if (idx > 0 && idx % 4 === 0) {
      row += cardH + 1
      col = 1
    }
    const r0 = row
    const c0 = col
    const r1 = row + cardH - 1
    const c1 = col + cardW - 1
    const accent = k.accent ?? GOLD

    // Caja
    ws.mergeCells(r0, c0, r1, c1)
    const box = ws.getCell(r0, c0)
    box.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CARD_BG } }
    box.border = {
      top: { style: THIN, color: { argb: accent } },
      left: { style: 'medium', color: { argb: accent } },
      bottom: { style: THIN, color: { argb: 'FFD9D2C4' } },
      right: { style: THIN, color: { argb: 'FFD9D2C4' } },
    }
    // Etiqueta + valor como texto enriquecido (dos líneas)
    box.alignment = { vertical: 'middle', horizontal: 'left', indent: 2, wrapText: true }
    const valueStr =
      typeof k.value === 'number'
        ? formatNumberForCard(k.value, k.numFmt)
        : String(k.value)
    box.value = {
      richText: [
        { text: k.label.toUpperCase() + '\n', font: { size: 9, bold: true, color: { argb: GREY } } },
        { text: valueStr, font: { size: 18, bold: true, color: { argb: accent === GOLD ? INK : accent } } },
      ],
    }
    col += cardW + 1
  })

  // Tabla resumen con barras de datos
  if (opts.summary && opts.summary.rows.length) {
    const startRow = row + cardH + 2
    ws.mergeCells(startRow, 1, startRow, opts.summary.columns.length)
    const st = ws.getCell(startRow, 1)
    st.value = opts.summary.title
    st.font = { name: 'Calibri', size: 13, bold: true, color: { argb: INK } }
    st.alignment = { vertical: 'middle', horizontal: 'left' }
    ws.getRow(startRow).height = 24

    const cols = opts.summary.columns
    const headerRow = ws.getRow(startRow + 1)
    cols.forEach((c, i) => {
      const cell = headerRow.getCell(i + 1)
      cell.value = c.header
      cell.font = { size: 10, bold: true, color: { argb: WHITE } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GOLD } }
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      cell.border = { top: BORDER_GREY, bottom: BORDER_GREY, left: BORDER_GREY, right: BORDER_GREY }
      ws.getColumn(i + 1).width = Math.max(ws.getColumn(i + 1).width || 12, c.width ?? 16)
    })
    headerRow.height = 20

    opts.summary.rows.forEach((r, idx) => {
      const er = ws.getRow(startRow + 2 + idx)
      cols.forEach((c, i) => {
        const cell = er.getCell(i + 1)
        cell.value = cellVal(r[c.key])
        if (c.numFmt) cell.numFmt = c.numFmt
        cell.font = { size: 10, color: { argb: INK } }
        cell.alignment = { vertical: 'middle', horizontal: c.numFmt ? 'right' : 'left', indent: c.numFmt ? 0 : 1 }
        if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CREAM } }
        cell.border = { bottom: BORDER_GREY }
      })
    })

    // Barras de datos
    cols.forEach((c, i) => {
      if (!c.dataBar) return
      const letter = colLetter(i + 1)
      const ref = `${letter}${startRow + 2}:${letter}${startRow + 1 + opts.summary!.rows.length}`
      ws.addConditionalFormatting({
        ref,
        rules: [{ type: 'dataBar', cfvo: [{ type: 'min' }, { type: 'max' }], color: { argb: NAVY }, priority: 1 } as any],
      })
    })
  }

  return ws
}

function formatNumberForCard(v: number, numFmt?: string): string {
  if (numFmt === PCT) return (v * 100).toFixed(1) + '%'
  if (numFmt === MONEY || numFmt === MONEY0) {
    return '$' + Math.round(v).toLocaleString('en-US')
  }
  return v.toLocaleString('en-US')
}

async function toBuffer(wb: ExcelJS.Workbook): Promise<Buffer> {
  wb.creator = 'Sistema Restrepo Acosta'
  wb.created = new Date()
  const ab = await wb.xlsx.writeBuffer()
  return Buffer.from(ab as ArrayBuffer)
}

// ============================================================
// REPORTE TÉCNICO
// ============================================================
export interface TechExcelData {
  projects: any[] // con phases.items, draws, providers(quotes,documents), budgetLines, inspections, tasks, notes, files
  priceRefs: any[]
  drawLineContributions: any[]
  subcontractorContracts: any[] // con paymentSchedule
  changeOrders?: any[]   // R3
  punchListItems?: any[] // R3
  itemDocuments?: any[]  // R4: soportes (facturas/cotizaciones) de actividades
  // R4: snapshot completo para RESTAURACIÓN EXACTA. Si viene, se incrusta como
  // JSON en una hoja oculta "_RESTORE" — así el MISMO Excel presentable sirve
  // para recargar el sistema con fidelidad total (IDs y relaciones intactos).
  restoreSnapshot?: any
}

// Celdas de Excel aceptan máx. 32,767 caracteres → el JSON se parte en trozos.
const RESTORE_SHEET = '_RESTORE'
const RESTORE_CHUNK = 30000

function addRestoreSheet(wb: ExcelJS.Workbook, snapshot: any) {
  const json = JSON.stringify(snapshot) // compacto (sin pretty-print)
  const ws = wb.addWorksheet(RESTORE_SHEET)
  ws.getCell('A1').value = 'NO EDITAR — datos de restauración exacta del sistema (JSON). Hoja oculta.'
  for (let i = 0, row = 2; i < json.length; i += RESTORE_CHUNK, row++) {
    ws.getCell(`A${row}`).value = json.slice(i, i + RESTORE_CHUNK)
  }
  ws.state = 'veryHidden' // no aparece en las pestañas de Excel
}

// Lee el snapshot embebido en un .xlsx generado por buildTechExcel.
// Devuelve null si el archivo no trae hoja _RESTORE (Excel viejo o externo).
export async function readRestoreSnapshotFromXlsx(buffer: Buffer): Promise<any | null> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer as any)
  const ws = wb.getWorksheet(RESTORE_SHEET)
  if (!ws) return null
  let json = ''
  for (let r = 2; r <= ws.rowCount; r++) {
    const v = ws.getCell(`A${r}`).value
    if (typeof v === 'string') json += v
    else if (v !== null && v !== undefined) json += String(v)
  }
  if (!json.trim()) return null
  return JSON.parse(json)
}

export async function buildTechExcel(data: TechExcelData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const { projects, priceRefs, subcontractorContracts } = data
  const changeOrders = data.changeOrders ?? []
  const punchListItems = data.punchListItems ?? []
  const projName = new Map(projects.map((p) => [p.id, p.name]))

  const num = (v: any) => Number(v) || 0
  const allBudget = projects.flatMap((p) => p.budgetLines || [])
  const allItems = projects.flatMap((p) => (p.phases || []).flatMap((ph: any) => ph.items || []))
  const allDraws = projects.flatMap((p) => p.draws || [])

  const presupuestoTotal = allBudget.reduce((s, b) => s + num(b.valorInicial), 0)
  const aprobadoTotal = allBudget.reduce((s, b) => s + num(b.valorAprobado), 0)
  const pagadoSubsTotal = allBudget.reduce((s, b) => s + num(b.pagadoSubs), 0)
  const itemsDone = allItems.filter((i) => i.completado).length
  const wiredTotal = allDraws.reduce((s, d) => s + num(d.netWire), 0)
  const subValor = subcontractorContracts.reduce((s, c) => s + num(c.contractValue), 0)

  // ── Resumen por proyecto ──
  const projSummary = projects.map((p) => {
    const bl = p.budgetLines || []
    const items = (p.phases || []).flatMap((ph: any) => ph.items || [])
    const draws = p.draws || []
    const pres = bl.reduce((s: number, b: any) => s + num(b.valorInicial), 0)
    const apr = bl.reduce((s: number, b: any) => s + num(b.valorAprobado), 0)
    return {
      proyecto: p.name,
      presupuesto: pres,
      aprobado: apr,
      avance: pres > 0 ? apr / pres : 0,
      items: items.length,
      itemsDone: items.length ? items.filter((i: any) => i.completado).length / items.length : 0,
      draws: draws.length,
      wired: draws.reduce((s: number, d: any) => s + num(d.netWire), 0),
    }
  })

  addDashboard(wb, {
    title: '🏗  Reporte Técnico de Obra — Restrepo Acosta',
    subtitle: `Generado ${new Date().toLocaleString('es-CO')} · ${projects.length} proyecto(s) · Plan B de control (no editar para restaurar)`,
    kpis: [
      { label: 'Proyectos', value: projects.length, numFmt: INT, accent: NAVY },
      { label: 'Presupuesto total', value: presupuestoTotal, numFmt: MONEY0 },
      { label: 'Aprobado (ejecutado)', value: aprobadoTotal, numFmt: MONEY0, accent: GREEN },
      { label: '% Avance presupuesto', value: presupuestoTotal ? aprobadoTotal / presupuestoTotal : 0, numFmt: PCT, accent: GOLD },
      { label: 'Items totales', value: allItems.length, numFmt: INT, accent: NAVY },
      { label: '% Items completados', value: allItems.length ? itemsDone / allItems.length : 0, numFmt: PCT, accent: GREEN },
      { label: 'Draws', value: allDraws.length, numFmt: INT, accent: NAVY },
      { label: 'Total wired (neto)', value: wiredTotal, numFmt: MONEY0, accent: GREEN },
      { label: 'Pagado a subs', value: pagadoSubsTotal, numFmt: MONEY0, accent: RED },
      { label: 'Subcontratos', value: subcontractorContracts.length, numFmt: INT, accent: NAVY },
      { label: 'Valor subcontratos', value: subValor, numFmt: MONEY0 },
      { label: 'Proveedores', value: projects.flatMap((p) => p.providers || []).length, numFmt: INT, accent: NAVY },
      { label: 'Impacto COs aprobados', value: changeOrders.filter((c: any) => c.status === 'APROBADO').reduce((s2: number, c: any) => s2 + (Number(c.costDelta) || 0), 0), numFmt: MONEY0, accent: RED },
      { label: 'COs sin decidir', value: changeOrders.filter((c: any) => c.status === 'BORRADOR').length, numFmt: INT, accent: GOLD },
      { label: 'Punch list abiertos', value: punchListItems.filter((i: any) => i.status !== 'VERIFICADO').length, numFmt: INT, accent: RED },
      { label: 'Punch verificados', value: punchListItems.filter((i: any) => i.status === 'VERIFICADO').length, numFmt: INT, accent: GREEN },
    ],
    summary: {
      title: 'Resumen por proyecto',
      columns: [
        { header: 'Proyecto', key: 'proyecto', width: 26 },
        { header: 'Presupuesto', key: 'presupuesto', width: 16, numFmt: MONEY0, dataBar: true },
        { header: 'Aprobado', key: 'aprobado', width: 16, numFmt: MONEY0 },
        { header: '% Avance', key: 'avance', width: 11, numFmt: PCT },
        { header: 'Items', key: 'items', width: 9, numFmt: INT },
        { header: '% Items OK', key: 'itemsDone', width: 11, numFmt: PCT },
        { header: 'Draws', key: 'draws', width: 9, numFmt: INT },
        { header: 'Wired', key: 'wired', width: 16, numFmt: MONEY0, dataBar: true },
      ],
      rows: projSummary,
    },
  })

  // ── Proyectos ──
  addTableSheet(wb, {
    name: 'Proyectos',
    title: 'Proyectos',
    columns: [
      { header: 'Nombre', key: 'name', width: 26 },
      { header: 'SPV', key: 'spv', width: 18 },
      { header: 'Dirección', key: 'address', width: 30 },
      { header: 'Condado', key: 'county', width: 14 },
      { header: 'SF Heated', key: 'sfHeated', width: 11, numFmt: INT },
      { header: 'Lender', key: 'lender', width: 18 },
      { header: 'Loan #', key: 'loanNumber', width: 14 },
      { header: 'Loan Amount', key: 'loanAmount', width: 15, numFmt: MONEY0, total: true },
      { header: 'Tasa %', key: 'interestRate', width: 9 },
      { header: 'ARV', key: 'arv', width: 15, numFmt: MONEY0, total: true },
      { header: 'Presup. construcción', key: 'constructionBudget', width: 18, numFmt: MONEY0, total: true },
      { header: 'Permit #', key: 'permitNumber', width: 14 },
    ],
    rows: projects,
  })

  // ── Presupuesto (budget lines) ──
  addTableSheet(wb, {
    name: 'Presupuesto',
    title: 'Presupuesto de construcción (Budget Lines)',
    columns: [
      { header: 'Proyecto', key: '_proj', width: 24 },
      { header: 'Div', key: 'divCode', width: 9 },
      { header: 'División', key: 'divName', width: 22 },
      { header: 'Item', key: 'itemCode', width: 10 },
      { header: 'Descripción', key: 'description', width: 34, wrap: true },
      { header: 'Vendor', key: 'vendor', width: 18 },
      { header: 'Valor inicial', key: 'valorInicial', width: 14, numFmt: MONEY, total: true },
      { header: 'Presentado', key: 'valorPresentado', width: 14, numFmt: MONEY, total: true },
      { header: 'Aprobado', key: 'valorAprobado', width: 14, numFmt: MONEY, total: true },
      { header: 'Pagado subs', key: 'pagadoSubs', width: 14, numFmt: MONEY, total: true },
    ],
    rows: projects.flatMap((p) => (p.budgetLines || []).map((b: any) => ({ ...b, _proj: p.name }))),
  })

  // ── Fases & Items ──
  // Mapa id → línea del budget para mostrar la asociación actividad ↔ Construction Budget
  const budgetLineById = new Map(allBudget.map((b: any) => [b.id, b]))
  addTableSheet(wb, {
    name: 'Fases e Items',
    title: 'Fases e Items de obra (Presupuesto & Ejecución unificados)',
    columns: [
      { header: 'Proyecto', key: '_proj', width: 22 },
      { header: 'Fase', key: '_fase', width: 22 },
      { header: 'Cód item', key: 'itemCode', width: 11 },
      { header: 'Actividad', key: 'activity', width: 34, wrap: true },
      { header: 'Estado', key: 'estado', width: 14 },
      { header: 'Responsable', key: 'responsable', width: 18 },
      { header: 'Presupuestado', key: 'valorPresupuestado', width: 14, numFmt: MONEY, total: true },
      { header: 'Budget asociado', key: '_budgetRef', width: 26, wrap: true },
      { header: 'Presup. budget', key: '_budgetVal', width: 14, numFmt: MONEY },
      { header: 'Ejecutado', key: 'valorEjecutado', width: 14, numFmt: MONEY, total: true },
      { header: 'Desviación', key: '_desv', width: 13, numFmt: MONEY },
      { header: 'Inicio real', key: 'fechaInicioReal', width: 13 },
      { header: 'Fin real', key: 'fechaFinReal', width: 13 },
      { header: 'Completado', key: 'completado', width: 12 },
      { header: 'Observaciones', key: 'observaciones', width: 30, wrap: true },
    ],
    rows: projects.flatMap((p) =>
      (p.phases || []).flatMap((ph: any) =>
        (ph.items || []).map((i: any) => {
          const bl: any = i.budgetLineId ? budgetLineById.get(i.budgetLineId) : null
          const budgetVal = bl ? num(bl.valorInicial) : null
          const baseline = budgetVal ?? num(i.valorPresupuestado)
          return {
            ...i,
            _proj: p.name,
            _fase: `${ph.code} ${ph.name}`,
            _budgetRef: bl ? `${bl.itemCode} — ${bl.description}` : '',
            _budgetVal: budgetVal,
            _desv: baseline > 0 ? num(i.valorEjecutado) - baseline : null,
          }
        })
      )
    ),
  })

  // ── Subactividades (desglose de cada actividad) ──
  const subActRows = projects.flatMap((p) =>
    (p.phases || []).flatMap((ph: any) =>
      (ph.items || []).flatMap((i: any) =>
        (i.subactivities || []).map((s: any) => ({
          ...s,
          _proj: p.name,
          _fase: `${ph.code} ${ph.name}`,
          _item: `${i.itemCode} — ${i.activity}`,
          _invoice: s.invoiceUrl ? (s.invoiceName || 'Sí') : '',
          _provider: s.provider?.name ?? '',
        }))
      )
    )
  )
  if (subActRows.length) {
    addTableSheet(wb, {
      name: 'Subactividades',
      title: 'Subactividades — desglose de gasto por actividad',
      columns: [
        { header: 'Proyecto', key: '_proj', width: 22 },
        { header: 'Fase', key: '_fase', width: 22 },
        { header: 'Actividad', key: '_item', width: 32, wrap: true },
        { header: 'Subactividad', key: 'description', width: 34, wrap: true },
        { header: 'Valor ejecutado', key: 'valorEjecutado', width: 15, numFmt: MONEY, total: true },
        { header: 'Fecha', key: 'fecha', width: 13 },
        { header: 'Proveedor', key: '_provider', width: 20 },
        { header: 'Responsable', key: 'responsable', width: 18 },
        { header: 'Invoice', key: '_invoice', width: 22 },
        { header: 'Observaciones', key: 'observaciones', width: 30, wrap: true },
      ],
      rows: subActRows,
    })
  }

  // ── Documentos de actividades (facturas / cotizaciones / soportes) ──
  const itemDocs = data.itemDocuments ?? []
  if (itemDocs.length) {
    const itemById = new Map(allItems.map((i: any) => [i.id, i]))
    addTableSheet(wb, {
      name: 'Docs actividades',
      title: 'Documentos por actividad (facturas, cotizaciones, soportes)',
      columns: [
        { header: 'Actividad', key: '_item', width: 34, wrap: true },
        { header: 'Tipo', key: 'type', width: 13 },
        { header: 'Nombre', key: 'name', width: 28, wrap: true },
        { header: 'Proveedor', key: 'vendor', width: 20 },
        { header: 'Monto', key: 'amount', width: 14, numFmt: MONEY, total: true },
        { header: 'Notas', key: 'notes', width: 28, wrap: true },
        { header: 'Fecha', key: 'createdAt', width: 13 },
        { header: 'URL', key: 'fileUrl', width: 55 },
      ],
      rows: itemDocs.map((d: any) => {
        const it: any = itemById.get(d.itemId)
        return { ...d, _item: it ? `${it.itemCode} — ${it.activity}` : d.itemId }
      }),
    })
  }

  // ── Draws ──
  addTableSheet(wb, {
    name: 'Draws',
    title: 'Draws (desembolsos del lender)',
    columns: [
      { header: 'Proyecto', key: '_proj', width: 24 },
      { header: '# Draw', key: 'drawNumber', width: 9, numFmt: INT },
      { header: 'Estado', key: 'estado', width: 14 },
      { header: 'Fecha solicitud', key: 'fechaSolicitud', width: 15 },
      { header: 'Fecha wire', key: 'fechaWire', width: 14 },
      { header: 'Monto solicitado', key: 'montoSolicitado', width: 16, numFmt: MONEY, total: true },
      { header: 'Net Wire', key: 'netWire', width: 15, numFmt: MONEY, total: true },
      { header: 'UPB post', key: 'upbPost', width: 15, numFmt: MONEY },
      { header: 'Saldo holdback', key: 'saldoHoldback', width: 15, numFmt: MONEY, total: true },
    ],
    rows: projects.flatMap((p) => (p.draws || []).map((d: any) => ({ ...d, _proj: p.name }))),
  })

  // ── Subcontratos ──
  const subRows = subcontractorContracts.flatMap((c: any) => {
    const sched = c.paymentSchedule || []
    if (sched.length === 0) {
      return [{ _proj: '', contractValue: c.contractValue, status: c.status, milestoneDesc: '(sin hitos)', amount: 0, dueDate: null, paidDate: null, payStatus: '' }]
    }
    return sched.map((s: any) => ({
      _proj: '',
      contractValue: c.contractValue,
      status: c.status,
      milestoneDesc: s.milestoneDesc,
      amount: s.amount,
      dueDate: s.dueDate,
      paidDate: s.paidDate,
      payStatus: s.status,
    }))
  })
  addTableSheet(wb, {
    name: 'Subcontratos',
    title: 'Subcontratos y calendario de pagos',
    columns: [
      { header: 'Valor contrato', key: 'contractValue', width: 15, numFmt: MONEY },
      { header: 'Estado contrato', key: 'status', width: 15 },
      { header: 'Hito', key: 'milestoneDesc', width: 34, wrap: true },
      { header: 'Monto hito', key: 'amount', width: 14, numFmt: MONEY, total: true },
      { header: 'Vence', key: 'dueDate', width: 13 },
      { header: 'Pagado', key: 'paidDate', width: 13 },
      { header: 'Estado pago', key: 'payStatus', width: 14 },
    ],
    rows: subRows,
  })

  // ── Proveedores ──
  addTableSheet(wb, {
    name: 'Proveedores',
    title: 'Proveedores y subcontratistas',
    columns: [
      { header: 'Proyecto', key: '_proj', width: 24 },
      { header: 'Nombre', key: 'name', width: 26 },
      { header: 'Tipo', key: 'type', width: 18 },
      { header: 'Teléfono', key: 'phone', width: 16 },
      { header: 'Email', key: 'email', width: 24 },
      { header: 'Licencia', key: 'license', width: 16 },
      { header: '# Documentos', key: '_docs', width: 12, numFmt: INT },
      { header: 'Notas', key: 'notes', width: 28, wrap: true },
    ],
    rows: projects.flatMap((p) => (p.providers || []).map((pr: any) => ({ ...pr, _proj: p.name, _docs: (pr.documents || []).length }))),
  })

  // ── Inspecciones ──
  addTableSheet(wb, {
    name: 'Inspecciones',
    title: 'Inspecciones',
    columns: [
      { header: 'Proyecto', key: '_proj', width: 24 },
      { header: 'WBS', key: 'wbs', width: 12 },
      { header: 'Tipo', key: 'tipo', width: 20 },
      { header: 'Fase', key: 'fase', width: 16 },
      { header: 'Solicitada', key: 'fechaSolicitada', width: 14 },
      { header: 'Realizada', key: 'fechaRealizada', width: 14 },
      { header: 'Resultado', key: 'resultado', width: 16 },
      { header: 'Estado', key: 'estado', width: 14 },
    ],
    rows: projects.flatMap((p) => (p.inspections || []).map((i: any) => ({ ...i, _proj: p.name }))),
  })

  // ── Tareas ──
  addTableSheet(wb, {
    name: 'Tareas',
    title: 'Tareas',
    columns: [
      { header: 'Proyecto', key: '_proj', width: 24 },
      { header: 'Título', key: 'title', width: 36, wrap: true },
      { header: 'Responsable', key: 'responsable', width: 18 },
      { header: 'Prioridad', key: 'priority', width: 12 },
      { header: 'Vence', key: 'dueDate', width: 13 },
      { header: 'Hecha', key: 'done', width: 9 },
    ],
    rows: projects.flatMap((p) => (p.tasks || []).map((t: any) => ({ ...t, _proj: p.name }))),
  })

  // ── Notas ──
  addTableSheet(wb, {
    name: 'Notas',
    title: 'Notas',
    columns: [
      { header: 'Proyecto', key: '_proj', width: 24 },
      { header: 'Título', key: 'title', width: 24 },
      { header: 'Contenido', key: 'content', width: 60, wrap: true },
    ],
    rows: projects.flatMap((p) => (p.notes || []).map((n: any) => ({ ...n, _proj: p.name }))),
  })

  // ── Archivos ──
  addTableSheet(wb, {
    name: 'Archivos',
    title: 'Archivos adjuntos (referencias Cloudinary)',
    subtitle: 'Los binarios viven en Cloudinary; aquí quedan las URLs para re-descargar o re-vincular.',
    columns: [
      { header: 'Proyecto', key: '_proj', width: 24 },
      { header: 'Nombre', key: 'name', width: 30 },
      { header: 'Categoría', key: 'category', width: 16 },
      { header: 'Tipo', key: 'kind', width: 16 },
      { header: 'URL', key: 'url', width: 60 },
    ],
    rows: projects.flatMap((p) => (p.files || []).map((f: any) => ({ ...f, _proj: p.name }))),
  })

  // ── Catálogo de precios ──
  addTableSheet(wb, {
    name: 'Precios ref',
    title: 'Catálogo de precios de referencia',
    columns: [
      { header: 'Categoría', key: 'category', width: 20 },
      { header: 'Código', key: 'code', width: 12 },
      { header: 'Descripción', key: 'description', width: 40, wrap: true },
      { header: 'Unidad', key: 'unit', width: 10 },
      { header: 'Precio bajo', key: 'priceLow', width: 13, numFmt: MONEY },
      { header: 'Precio alto', key: 'priceHigh', width: 13, numFmt: MONEY },
      { header: 'Región', key: 'region', width: 16 },
    ],
    rows: priceRefs,
  })

    // ── Change Orders (R3) ──
  if (changeOrders.length) {
    addTableSheet(wb, {
      name: 'Change Orders',
      title: 'Change Orders — cambios de alcance',
      columns: [
        { header: 'Proyecto', key: '_proj', width: 24 },
        { header: 'CO#', key: 'coNumber', width: 7, numFmt: INT },
        { header: 'Título', key: 'title', width: 36 },
        { header: 'Razón', key: 'reason', width: 18 },
        { header: 'Costo Δ', key: 'costDelta', width: 14, numFmt: MONEY0, total: true },
        { header: 'Días Δ', key: 'daysDelta', width: 9, numFmt: INT },
        { header: 'Estado', key: 'status', width: 12 },
        { header: 'Aprobó', key: 'approvedBy', width: 16 },
        { header: 'Fecha decisión', key: 'approvedAt', width: 14 },
      ],
      rows: changeOrders.map((c: any) => ({ ...c, _proj: projName.get(c.projectId) ?? c.projectId })),
    })
  }

  // ── Punch List (R3) ──
  if (punchListItems.length) {
    addTableSheet(wb, {
      name: 'Punch List',
      title: 'Punch List — cierre de obra',
      columns: [
        { header: 'Proyecto', key: '_proj', width: 24 },
        { header: 'Defecto', key: 'title', width: 36 },
        { header: 'Ubicación', key: 'location', width: 16 },
        { header: 'Responsable', key: 'responsable', width: 16 },
        { header: 'Severidad', key: 'severity', width: 11 },
        { header: 'Estado', key: 'status', width: 12 },
        { header: 'Verificado', key: 'resolvedAt', width: 14 },
      ],
      rows: punchListItems.map((i: any) => ({ ...i, _proj: projName.get(i.projectId) ?? i.projectId })),
    })
  }

  // ── Hoja oculta de restauración exacta (si se pasó el snapshot) ──
  if (data.restoreSnapshot) addRestoreSheet(wb, data.restoreSnapshot)

  return toBuffer(wb)
}

// ============================================================
// REPORTE FINANCIERO
// ============================================================
export interface FinanceSnapshot {
  spvs: any[]
  accounts: any[]
  partners: any[]
  lenders: any[]
  providers: any[]
  categories: any[]
  origins: any[]
  projects: any[]
  movements: any[] // con account, destAccount, category, origin, provider, partner, lender, project
  capital: any[]
  loans: any[]
  nonBank: any[]
  statements: any[]
  lines: any[]
  movDocs: any[]
  projDocs: any[]
}

export async function buildFinanceExcel(snap: FinanceSnapshot): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const num = (v: any) => Number(v) || 0

  // ── Saldos por cuenta (misma lógica que el dashboard del backend) ──
  const balances = new Map<number, number>()
  for (const a of snap.accounts) balances.set(a.id, num(a.initialBalance))
  for (const m of snap.movements) {
    if (m.type === 'Ingreso') balances.set(m.accountId, (balances.get(m.accountId) || 0) + num(m.amount))
    else if (m.type === 'Egreso') balances.set(m.accountId, (balances.get(m.accountId) || 0) - num(m.amount))
    else if (m.type === 'Interbancario') {
      balances.set(m.accountId, (balances.get(m.accountId) || 0) - num(m.amount))
      if (m.destAccountId) balances.set(m.destAccountId, (balances.get(m.destAccountId) || 0) + num(m.amount))
    }
  }
  const totalLiquidez = Array.from(balances.values()).reduce((s, v) => s + v, 0)
  const validMovs = snap.movements.filter((m) => !m.isIntercompany)
  const totalIngresos = validMovs.filter((m) => m.type === 'Ingreso').reduce((s, m) => s + num(m.amount), 0)
  const totalEgresos = validMovs.filter((m) => m.type === 'Egreso').reduce((s, m) => s + num(m.amount), 0)
  const totalCapital = snap.capital.reduce((s, c) => s + num(c.amount), 0) + snap.nonBank.reduce((s, c) => s + num(c.amount), 0)
  const totalLoans = snap.loans.reduce((s, l) => s + num(l.amount), 0)
  const totalRepaid = snap.loans.reduce((s, l) => s + num(l.totalRepaid), 0)

  // ── Egresos por categoría ──
  const byCat = new Map<string, number>()
  for (const m of validMovs.filter((m) => m.type === 'Egreso')) {
    const name = m.category?.name || '(sin categoría)'
    byCat.set(name, (byCat.get(name) || 0) + num(m.amount))
  }
  const catRows = Array.from(byCat.entries())
    .map(([categoria, monto]) => ({ categoria, monto }))
    .sort((a, b) => b.monto - a.monto)

  // ── Resumen por cuenta ──
  const accSummary = snap.accounts
    .map((a) => ({
      cuenta: a.name,
      banco: a.bank,
      saldo: balances.get(a.id) || 0,
      movs: snap.movements.filter((m) => m.accountId === a.id || m.destAccountId === a.id).length,
    }))
    .sort((a, b) => b.saldo - a.saldo)

  addDashboard(wb, {
    title: '💰  Reporte Financiero — Restrepo Acosta Global Holding',
    subtitle: `Generado ${new Date().toLocaleString('es-CO')} · CFO digital · Plan B de control (no editar para restaurar)`,
    kpis: [
      { label: 'Cuentas bancarias', value: snap.accounts.length, numFmt: INT, accent: NAVY },
      { label: 'Liquidez total', value: totalLiquidez, numFmt: MONEY0, accent: GREEN },
      { label: 'Movimientos', value: snap.movements.length, numFmt: INT, accent: NAVY },
      { label: 'Ingresos (operativo)', value: totalIngresos, numFmt: MONEY0, accent: GREEN },
      { label: 'Egresos (operativo)', value: totalEgresos, numFmt: MONEY0, accent: RED },
      { label: 'Neto (ing - egr)', value: totalIngresos - totalEgresos, numFmt: MONEY0, accent: totalIngresos - totalEgresos >= 0 ? GREEN : RED },
      { label: 'Capital aportado', value: totalCapital, numFmt: MONEY0, accent: GOLD },
      { label: 'Préstamos', value: totalLoans, numFmt: MONEY0, accent: NAVY },
      { label: 'Préstamos pagados', value: totalRepaid, numFmt: MONEY0, accent: GREEN },
      { label: 'Proyectos', value: snap.projects.length, numFmt: INT, accent: NAVY },
      { label: 'Socios', value: snap.partners.length, numFmt: INT, accent: NAVY },
      { label: 'SPVs', value: snap.spvs.length, numFmt: INT, accent: NAVY },
    ],
    summary: {
      title: 'Saldo por cuenta bancaria',
      columns: [
        { header: 'Cuenta', key: 'cuenta', width: 30 },
        { header: 'Banco', key: 'banco', width: 20 },
        { header: 'Saldo actual', key: 'saldo', width: 18, numFmt: MONEY, dataBar: true },
        { header: '# Movs', key: 'movs', width: 10, numFmt: INT },
      ],
      rows: accSummary,
    },
  })

  // ── Cuentas ──
  addTableSheet(wb, {
    name: 'Cuentas',
    title: 'Cuentas bancarias',
    columns: [
      { header: 'Código', key: 'code', width: 12 },
      { header: 'Nombre', key: 'name', width: 28 },
      { header: 'Banco', key: 'bank', width: 20 },
      { header: 'Tipo', key: 'type', width: 14 },
      { header: '# Cuenta', key: 'accountNumber', width: 16 },
      { header: 'SPV', key: '_spv', width: 18 },
      { header: 'Saldo inicial', key: 'initialBalance', width: 15, numFmt: MONEY, total: true },
      { header: 'Saldo calculado', key: '_saldo', width: 16, numFmt: MONEY, total: true, dataBar: true },
    ],
    rows: snap.accounts.map((a) => ({ ...a, _spv: a.spv?.name, _saldo: balances.get(a.id) || 0 })),
  })

  // ── Movimientos ──
  addTableSheet(wb, {
    name: 'Movimientos',
    title: 'Libro de movimientos bancarios',
    columns: [
      { header: 'Fecha', key: 'date', width: 13 },
      { header: 'Tipo', key: 'type', width: 13 },
      { header: 'Monto', key: 'amount', width: 15, numFmt: MONEY, total: true },
      { header: 'Concepto', key: 'concept', width: 36, wrap: true },
      { header: 'Cuenta', key: '_cuenta', width: 22 },
      { header: 'Cuenta destino', key: '_dest', width: 22 },
      { header: 'Categoría', key: '_cat', width: 20 },
      { header: 'Origen', key: '_origen', width: 18 },
      { header: 'Proveedor', key: '_prov', width: 20 },
      { header: 'Socio', key: '_socio', width: 18 },
      { header: 'Proyecto', key: '_proy', width: 20 },
      { header: 'Intercompany', key: 'isIntercompany', width: 13 },
      { header: 'Notas', key: 'notes', width: 26, wrap: true },
    ],
    rows: snap.movements.map((m) => ({
      ...m,
      date: m.date instanceof Date ? m.date : m.date ? new Date(m.date) : null,
      _cuenta: m.account?.name,
      _dest: m.destAccount?.name,
      _cat: m.category?.name,
      _origen: m.origin?.name,
      _prov: m.provider?.name,
      _socio: m.partner?.fullName,
      _proy: m.project?.name,
    })),
  })

  // ── Egresos por categoría ──
  addTableSheet(wb, {
    name: 'Egresos por categoría',
    title: 'Egresos agrupados por categoría (operativo)',
    columns: [
      { header: 'Categoría', key: 'categoria', width: 36 },
      { header: 'Monto', key: 'monto', width: 18, numFmt: MONEY, total: true, dataBar: true },
    ],
    rows: catRows,
  })

  // ── Capital ──
  addTableSheet(wb, {
    name: 'Capital aportado',
    title: 'Aportes de capital (equity)',
    columns: [
      { header: 'Fecha', key: 'date', width: 13 },
      { header: 'Socio', key: '_socio', width: 22 },
      { header: 'Proyecto', key: '_proy', width: 22 },
      { header: 'Monto', key: 'amount', width: 15, numFmt: MONEY, total: true },
      { header: 'Concepto', key: 'concept', width: 34, wrap: true },
      { header: 'Origen', key: 'origin', width: 16 },
    ],
    rows: snap.capital.map((c) => ({
      ...c,
      date: c.date instanceof Date ? c.date : c.date ? new Date(c.date) : null,
      _socio: c.partner?.fullName,
      _proy: c.project?.name,
    })),
  })

  // ── Préstamos ──
  addTableSheet(wb, {
    name: 'Préstamos',
    title: 'Préstamos (deuda)',
    columns: [
      { header: 'Fecha', key: 'date', width: 13 },
      { header: 'Lender', key: '_lender', width: 22 },
      { header: 'Proyecto', key: '_proy', width: 22 },
      { header: 'Monto', key: 'amount', width: 15, numFmt: MONEY, total: true },
      { header: 'Tasa %', key: 'interestRate', width: 9 },
      { header: 'Plazo m', key: 'termMonths', width: 9, numFmt: INT },
      { header: 'Estado', key: 'status', width: 14 },
      { header: 'Total pagado', key: 'totalRepaid', width: 15, numFmt: MONEY, total: true },
    ],
    rows: snap.loans.map((l) => ({
      ...l,
      date: l.date instanceof Date ? l.date : l.date ? new Date(l.date) : null,
      _lender: l.lender?.name,
      _proy: l.project?.name,
    })),
  })

  // ── Proyectos ──
  addTableSheet(wb, {
    name: 'Proyectos fin',
    title: 'Proyectos del portafolio financiero',
    columns: [
      { header: 'Código', key: 'code', width: 12 },
      { header: 'Nombre', key: 'name', width: 26 },
      { header: 'SPV', key: '_spv', width: 18 },
      { header: 'Línea', key: 'line', width: 16 },
      { header: 'Estado', key: 'status', width: 14 },
      { header: 'Precio compra', key: 'purchasePrice', width: 15, numFmt: MONEY0, total: true },
      { header: 'ARV', key: 'arv', width: 15, numFmt: MONEY0, total: true },
      { header: 'Costo esperado', key: 'expectedCost', width: 15, numFmt: MONEY0, total: true },
      { header: 'Cash In', key: 'cashIn', width: 15, numFmt: MONEY0, total: true },
    ],
    rows: snap.projects.map((p) => ({ ...p, _spv: p.spv?.name })),
  })

  // ── Extractos ──
  addTableSheet(wb, {
    name: 'Extractos',
    title: 'Extractos bancarios',
    columns: [
      { header: 'Archivo', key: 'filename', width: 30 },
      { header: 'Cuenta', key: '_cuenta', width: 22 },
      { header: 'Período inicio', key: 'periodStart', width: 14 },
      { header: 'Período fin', key: 'periodEnd', width: 14 },
      { header: 'Saldo inicial', key: 'openingBalance', width: 15, numFmt: MONEY },
      { header: 'Saldo final', key: 'closingBalance', width: 15, numFmt: MONEY },
    ],
    rows: snap.statements.map((s) => ({
      ...s,
      _cuenta: s.account?.name,
      periodStart: s.periodStart instanceof Date ? s.periodStart : s.periodStart ? new Date(s.periodStart) : null,
      periodEnd: s.periodEnd instanceof Date ? s.periodEnd : s.periodEnd ? new Date(s.periodEnd) : null,
    })),
  })

  // ── Socios, Lenders, Proveedores, Catálogos, SPVs ──
  addTableSheet(wb, {
    name: 'Socios',
    title: 'Socios',
    columns: [
      { header: 'Código', key: 'code', width: 12 },
      { header: 'Nombre', key: 'fullName', width: 28 },
      { header: 'Email', key: 'email', width: 26 },
      { header: 'Notas', key: 'notes', width: 30, wrap: true },
    ],
    rows: snap.partners,
  })
  addTableSheet(wb, {
    name: 'Lenders',
    title: 'Lenders (prestamistas)',
    columns: [
      { header: 'Nombre', key: 'name', width: 26 },
      { header: 'Tipo', key: 'type', width: 16 },
      { header: 'Contacto', key: 'contactName', width: 20 },
      { header: 'Email', key: 'email', width: 24 },
      { header: 'Teléfono', key: 'phone', width: 16 },
    ],
    rows: snap.lenders,
  })
  addTableSheet(wb, {
    name: 'Proveedores fin',
    title: 'Proveedores (financiero)',
    columns: [
      { header: 'Nombre', key: 'name', width: 26 },
      { header: 'Tipo', key: 'type', width: 16 },
      { header: 'Contacto', key: 'contactName', width: 20 },
      { header: 'Teléfono', key: 'phone', width: 16 },
      { header: 'Email', key: 'email', width: 24 },
    ],
    rows: snap.providers,
  })
  addTableSheet(wb, {
    name: 'Catálogos',
    title: 'Categorías de gasto y orígenes de ingreso',
    columns: [
      { header: 'Tipo', key: '_tipo', width: 16 },
      { header: 'Código', key: 'code', width: 12 },
      { header: 'Nombre', key: 'name', width: 28 },
      { header: 'Grupo', key: 'group', width: 18 },
    ],
    rows: [
      ...snap.categories.map((c) => ({ ...c, _tipo: 'Gasto' })),
      ...snap.origins.map((o) => ({ ...o, _tipo: 'Ingreso', group: '' })),
    ],
  })
  addTableSheet(wb, {
    name: 'SPVs',
    title: 'SPVs (entidades)',
    columns: [
      { header: 'Código', key: 'code', width: 14 },
      { header: 'Nombre', key: 'name', width: 36 },
      { header: 'Notas', key: 'notes', width: 36, wrap: true },
    ],
    rows: snap.spvs,
  })

  return toBuffer(wb)
}
