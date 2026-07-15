// ============================================================
// backupBinaries.ts — Empaqueta los archivos binarios (PDFs/fotos)
// dentro del ZIP de backup, descargándolos desde Cloudinary.
// ------------------------------------------------------------
// El backup guarda las URLs en los JSON; este módulo además baja
// los binarios y los mete en carpetas dentro del ZIP, con un índice
// CSV que mapea cada archivo a su registro de origen. Best-effort:
// si un archivo falla, se registra en el índice y el backup continúa.
// ============================================================
import http from 'http'
import https from 'https'
import type { Archiver } from 'archiver'

const ALLOWED_HOSTS = ['res.cloudinary.com', 'cloudinary.com']
const MAX_REDIRECTS = 5
const REQUEST_TIMEOUT_MS = 30_000
const MAX_FILE_BYTES = 80 * 1024 * 1024 // 80 MB por archivo (corta binarios anómalos)

const isAllowedHost = (hostname: string) =>
  ALLOWED_HOSTS.some((h) => hostname === h || hostname.endsWith('.' + h))

export interface BinaryTarget {
  module: 'tecnico' | 'financiero' | 'administrativo'
  entity: string // descripción legible del registro de origen
  folder: string // subcarpeta dentro de files/<module>/
  name: string // nombre sugerido (puede venir sin extensión)
  url: string
}

export interface ManifestRow {
  Modulo: string
  Entidad: string
  Archivo: string
  RutaEnZip: string
  Estado: string
  URL: string
}

// Descarga una URL a Buffer siguiendo redirecciones, con allowlist de host.
function fetchBuffer(url: string, redirectsLeft = MAX_REDIRECTS): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return reject(new Error('URL inválida'))
    }
    if (!isAllowedHost(parsed.hostname)) return reject(new Error(`host no permitido: ${parsed.hostname}`))

    const client = parsed.protocol === 'http:' ? http : https
    const req = client.get(url, (resp) => {
      const status = resp.statusCode ?? 0
      if (status >= 300 && status < 400 && resp.headers.location) {
        resp.resume()
        if (redirectsLeft <= 0) return reject(new Error('demasiadas redirecciones'))
        const next = new URL(resp.headers.location, url).toString()
        return fetchBuffer(next, redirectsLeft - 1).then(resolve, reject)
      }
      if (status < 200 || status >= 400) {
        resp.resume()
        return reject(new Error(`upstream ${status}`))
      }
      const chunks: Buffer[] = []
      let total = 0
      resp.on('data', (c: Buffer) => {
        total += c.length
        if (total > MAX_FILE_BYTES) {
          req.destroy()
          return reject(new Error(`excede ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB`))
        }
        chunks.push(c)
      })
      resp.on('end', () => resolve(Buffer.concat(chunks)))
      resp.on('error', reject)
    })
    req.setTimeout(REQUEST_TIMEOUT_MS, () => req.destroy(new Error('timeout')))
    req.on('error', reject)
  })
}

function getExt(s: string): string {
  const m = s.match(/\.([a-z0-9]{2,5})(?:[?#]|$)/i)
  return m ? m[1].toLowerCase() : ''
}

// Limpia un fragmento para usarlo como nombre de carpeta/archivo seguro.
function safe(s: string | null | undefined, fallback = 'sin-nombre'): string {
  const cleaned = (s ?? '').toString().replace(/[\\/:*?"<>|\r\n]+/g, '_').replace(/\s+/g, ' ').trim()
  return cleaned.slice(0, 80) || fallback
}

// Asegura que el nombre tenga extensión (la infiere desde la URL si falta).
function ensureExt(name: string, url: string): string {
  if (getExt(name)) return name
  const urlExt = getExt(new URL(url).pathname)
  return urlExt ? `${name}.${urlExt}` : name
}

// ── Recolectores de objetivos ───────────────────────────────────
export function collectTechTargets(projects: any[], itemDocuments: any[], subcontracts: any[]): BinaryTarget[] {
  const out: BinaryTarget[] = []
  const push = (entity: string, folder: string, name: string, url: any) => {
    if (url && typeof url === 'string' && url.trim()) out.push({ module: 'tecnico', entity, folder, name, url })
  }
  for (const p of projects) {
    const proj = safe(p.name, 'proyecto')
    for (const f of p.files || []) push(`Archivo · ${p.name}`, `${proj}/archivos`, safe(f.name, f.id), f.url)
    for (const pr of p.providers || []) {
      for (const doc of pr.documents || []) push(`Doc proveedor · ${pr.name}`, `${proj}/proveedores`, safe(`${pr.name}-${doc.name}`, doc.id), doc.fileUrl)
      for (const q of pr.quotes || []) push(`Cotización · ${pr.name}`, `${proj}/cotizaciones`, safe(`${pr.name}-${q.description}`, q.id), q.fileUrl)
    }
    for (const d of p.draws || []) {
      const dn = `draw-${d.drawNumber}`
      push(`Draw ${d.drawNumber} · ${p.name}`, `${proj}/draws`, `${dn}-pdf`, d.pdfUrl)
      push(`Draw ${d.drawNumber} factura lender`, `${proj}/draws`, safe(d.invoiceLenderName || `${dn}-factura`), d.invoiceLenderUrl)
      push(`Draw ${d.drawNumber} aprobación lender`, `${proj}/draws`, safe(d.lenderApprovalName || `${dn}-aprobacion`), d.lenderApprovalUrl)
      push(`Draw ${d.drawNumber} excel lender`, `${proj}/draws`, safe(d.lenderExcelName || `${dn}-excel`), d.lenderExcelUrl)
    }
  }
  // itemDocuments y subcontratos vienen como arrays planos (sin nombre de proyecto a la mano)
  for (const idoc of itemDocuments || []) push(`Doc item · ${idoc.name}`, `items-documentos`, safe(idoc.name, idoc.id), idoc.fileUrl)
  for (const c of subcontracts || []) push(`Contrato subcontratista`, `subcontratos`, safe(c.contractName || `contrato-${c.id}`), c.contractUrl)
  return out
}

export function collectFinanceTargets(snap: any): BinaryTarget[] {
  const out: BinaryTarget[] = []
  const push = (entity: string, folder: string, name: string, url: any) => {
    if (url && typeof url === 'string' && url.trim()) out.push({ module: 'financiero', entity, folder, name, url })
  }
  for (const d of snap.movDocs || []) push(`Doc movimiento #${d.movementId}`, `movimientos`, safe(d.filename, d.id), d.url)
  for (const d of snap.projDocs || []) push(`Doc proyecto #${d.projectId}`, `proyectos`, safe(d.filename, d.id), d.url)
  for (const s of snap.statements || []) push(`Extracto · ${s.filename}`, `extractos`, safe(s.filename, s.id), s.url)
  return out
}

export function collectAdminTargets(documents: any[], companies: any[]): BinaryTarget[] {
  const out: BinaryTarget[] = []
  const nameOf = new Map((companies || []).map((c: any) => [c.id, c.name]))
  for (const d of documents || []) {
    if (!d.url || typeof d.url !== 'string' || !d.url.trim() || d.url.startsWith('local:')) continue
    const companyName = safe(nameOf.get(d.companyId) || `empresa-${d.companyId}`)
    out.push({
      module: 'administrativo',
      entity: `Doc corporativo · ${nameOf.get(d.companyId) ?? d.companyId}`,
      folder: companyName,
      name: safe(d.filename, String(d.id)),
      url: d.url,
    })
  }
  return out
}

// ── Descarga secuencial + append al archive (memoria acotada) ────
// Devuelve las filas del manifiesto. No lanza: cada fallo se registra.
export async function appendBinaries(archive: Archiver, targets: BinaryTarget[]): Promise<ManifestRow[]> {
  const manifest: ManifestRow[] = []
  const usedPaths = new Set<string>()
  let idx = 0
  for (const t of targets) {
    idx++
    const fileName = ensureExt(t.name, t.url)
    let zipPath = `files/${t.module}/${t.folder}/${fileName}`
    // Evita colisiones de ruta
    if (usedPaths.has(zipPath)) zipPath = `files/${t.module}/${t.folder}/${idx}-${fileName}`
    usedPaths.add(zipPath)
    try {
      const buf = await fetchBuffer(t.url)
      archive.append(buf, { name: zipPath })
      manifest.push({ Modulo: t.module, Entidad: t.entity, Archivo: fileName, RutaEnZip: zipPath, Estado: `OK (${Math.round(buf.length / 1024)} KB)`, URL: t.url })
    } catch (e: any) {
      manifest.push({ Modulo: t.module, Entidad: t.entity, Archivo: fileName, RutaEnZip: '(no descargado)', Estado: `FALLÓ: ${e?.message ?? String(e)}`, URL: t.url })
    }
  }
  return manifest
}

// Construye un CSV simple (compatible Excel) desde las filas del manifiesto.
export function manifestToCsv(rows: ManifestRow[]): string {
  const headers = ['Modulo', 'Entidad', 'Archivo', 'RutaEnZip', 'Estado', 'URL']
  const esc = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`
  const lines = [headers.join(',')]
  for (const r of rows) lines.push(headers.map((h) => esc((r as any)[h])).join(','))
  return '﻿' + lines.join('\r\n') // BOM para que Excel lea acentos
}
