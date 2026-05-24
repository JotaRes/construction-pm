import { Router, Request, Response } from 'express'
import http from 'http'
import https from 'https'

const router = Router()

const ALLOWED_HOSTS = ['res.cloudinary.com', 'cloudinary.com']
const MAX_REDIRECTS = 5
const REQUEST_TIMEOUT_MS = 30_000

const isAllowedHost = (hostname: string) =>
  ALLOWED_HOSTS.some(h => hostname === h || hostname.endsWith('.' + h))

// Mapa de extensiones → MIME types (para inferir cuando upstream no lo da bien)
const EXT_MIME_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml',
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  csv: 'text/csv', txt: 'text/plain', zip: 'application/zip',
}

// Extrae la extensión de un nombre/path en minúsculas, devuelve '' si no hay
function getExt(s: string): string {
  const m = s.match(/\.([a-z0-9]{2,5})(?:[?#]|$)/i)
  return m ? m[1].toLowerCase() : ''
}

// RFC 5987 — codifica filename para header HTTP cuando tiene caracteres no-ASCII
function rfc5987(value: string): string {
  return encodeURIComponent(value)
    .replace(/['()]/g, escape)
    .replace(/\*/g, '%2A')
    .replace(/%(?:7C|60|5E)/g, unescape)
}

// Construye un valor Content-Disposition válido aún con caracteres Unicode
// usando ambos: filename (ASCII fallback) y filename* (RFC 5987 UTF-8)
function buildContentDisposition(name: string, inline: boolean): string {
  const cleaned = name.replace(/[\r\n"]/g, '').trim() || 'download'
  // ASCII-safe version (reemplaza chars no-ASCII por _)
  const asciiSafe = cleaned.replace(/[^\x20-\x7E]/g, '_')
  const dispType = inline ? 'inline' : 'attachment'
  return `${dispType}; filename="${asciiSafe}"; filename*=UTF-8''${rfc5987(cleaned)}`
}

const fetchWithRedirects = (
  url: string,
  res: Response,
  disposition: string,
  inferredCt: string | undefined,
  redirectsLeft: number
): void => {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    if (!res.headersSent) res.status(400).json({ error: 'Invalid upstream URL' })
    return
  }

  const client = parsed.protocol === 'http:' ? http : https
  const upstream = client.get(url, (proxyRes) => {
    const status = proxyRes.statusCode ?? 0

    if (status >= 300 && status < 400 && proxyRes.headers.location) {
      proxyRes.resume()
      if (redirectsLeft <= 0) {
        if (!res.headersSent) res.status(508).json({ error: 'Too many redirects' })
        return
      }
      const next = new URL(proxyRes.headers.location, url).toString()
      fetchWithRedirects(next, res, disposition, inferredCt, redirectsLeft - 1)
      return
    }

    if (status < 200 || status >= 400) {
      console.error(`Download proxy upstream ${status} for ${parsed.hostname}${parsed.pathname}`)
      proxyRes.resume()
      if (!res.headersSent) res.status(502).json({ error: `Upstream responded ${status}` })
      return
    }

    const upstreamCt = proxyRes.headers['content-type']
    const isUpstreamGeneric =
      !upstreamCt ||
      upstreamCt === 'application/octet-stream' ||
      upstreamCt.startsWith('binary/') ||
      // Cloudinary a veces sirve PDFs como image/* cuando se subieron con resource_type=image
      (inferredCt === 'application/pdf' && upstreamCt.startsWith('image/'))

    const finalCt = isUpstreamGeneric && inferredCt
      ? inferredCt
      : (upstreamCt || inferredCt || 'application/octet-stream')

    res.setHeader('Content-Type', finalCt)

    const cl = proxyRes.headers['content-length']
    if (cl) res.setHeader('Content-Length', cl)
    res.setHeader('Content-Disposition', disposition)
    res.setHeader('Cache-Control', 'private, max-age=3600')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.status(200)
    proxyRes.pipe(res)
  })

  upstream.setTimeout(REQUEST_TIMEOUT_MS, () => {
    upstream.destroy(new Error('Upstream timeout'))
  })

  upstream.on('error', (err) => {
    console.error(`Download proxy error for ${parsed.hostname}${parsed.pathname}:`, err.message)
    if (!res.headersSent) res.status(502).json({ error: `Upstream error: ${err.message}` })
    else res.destroy()
  })
}

router.get('/', (req: Request, res: Response) => {
  const rawUrl = req.query.url as string
  const inline = req.query.inline === '1'
  // Override del filename desde el query — garantiza nombre + extensión correctos
  // aunque el archivo en Cloudinary fue subido sin extensión (resource_type=raw)
  const customName = req.query.name as string | undefined

  if (!rawUrl) {
    res.status(400).json({ error: 'Missing url parameter' })
    return
  }

  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    res.status(400).json({ error: 'Invalid URL' })
    return
  }

  if (!isAllowedHost(parsed.hostname)) {
    res.status(403).json({ error: 'URL host not allowed' })
    return
  }

  // === Decidir el filename final ===
  // 1. Si viene customName, usarlo (es el nombre amigable que ve el usuario en la app).
  // 2. Si no, extraer el último segmento del path de la URL.
  // 3. Asegurar que tenga extensión: copiar desde customName o desde URL si falta.
  const urlBasename = decodeURIComponent(parsed.pathname.split('/').pop() ?? 'download')
  let finalName = (customName && customName.trim()) ? customName.trim() : urlBasename
  const nameExt = getExt(finalName)
  const urlExt = getExt(parsed.pathname)
  if (!nameExt) {
    const ext = urlExt || (customName ? getExt(customName) : '')
    if (ext) finalName = `${finalName}.${ext}`
  }

  // === Inferir Content-Type por extensión del NAME (no de la URL — Cloudinary raw no tiene ext) ===
  const finalExt = getExt(finalName)
  const inferredCt = EXT_MIME_MAP[finalExt]

  const disposition = buildContentDisposition(finalName, inline)

  req.on('close', () => {
    if (!res.writableEnded) res.destroy()
  })

  fetchWithRedirects(rawUrl, res, disposition, inferredCt, MAX_REDIRECTS)
})

export default router
