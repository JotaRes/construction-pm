import { Router, Request, Response } from 'express'
import http from 'http'
import https from 'https'

const router = Router()

const ALLOWED_HOSTS = ['res.cloudinary.com', 'cloudinary.com']
const MAX_REDIRECTS = 5
const REQUEST_TIMEOUT_MS = 30_000

const isAllowedHost = (hostname: string) =>
  ALLOWED_HOSTS.some(h => hostname === h || hostname.endsWith('.' + h))

const fetchWithRedirects = (
  url: string,
  res: Response,
  disposition: string,
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
      fetchWithRedirects(next, res, disposition, redirectsLeft - 1)
      return
    }

    if (status < 200 || status >= 400) {
      console.error(`Download proxy upstream ${status} for ${parsed.hostname}${parsed.pathname}`)
      proxyRes.resume()
      if (!res.headersSent) res.status(502).json({ error: `Upstream responded ${status}` })
      return
    }

    // === Inferir Content-Type apropiado ===
    // Cloudinary a veces sirve PDFs subidos como resource_type=image con un
    // Content-Type genérico (application/octet-stream u image/*). Si la URL
    // termina en una extensión conocida, forzamos el mime correcto para que
    // el navegador y WhatsApp lo abran nativamente.
    const upstreamCt = proxyRes.headers['content-type']
    const ext = (parsed.pathname.split('.').pop() || '').toLowerCase()
    const extMimeMap: Record<string, string> = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
      mp4: 'video/mp4', mov: 'video/quicktime',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xls: 'application/vnd.ms-excel',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      doc: 'application/msword',
      zip: 'application/zip',
    }
    const inferredCt = extMimeMap[ext]
    const isGeneric = !upstreamCt || upstreamCt === 'application/octet-stream' || upstreamCt.startsWith('binary/')
    const finalCt = inferredCt || upstreamCt || 'application/octet-stream'
    // Si upstream dio un image/* pero la extensión es PDF (caso bug de resource_type=image),
    // sobreescribir con el mime correcto
    const useInferred = inferredCt && (isGeneric || (ext === 'pdf' && upstreamCt?.startsWith('image/')))
    res.setHeader('Content-Type', useInferred ? inferredCt : finalCt)

    const cl = proxyRes.headers['content-length']
    if (cl) res.setHeader('Content-Length', cl)
    res.setHeader('Content-Disposition', disposition)
    res.setHeader('Cache-Control', 'private, max-age=3600')
    // Permite que WhatsApp Web y otros previsualicen
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
  // Permite override del filename desde el query para garantizar extensión correcta
  // (útil cuando el archivo en Cloudinary fue subido sin extensión visible)
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

  let rawName = customName || decodeURIComponent(parsed.pathname.split('/').pop() ?? 'download')
  // Si el archivo no tiene extensión pero la URL sí, copiar la extensión
  const urlExt = parsed.pathname.split('.').pop()?.toLowerCase()
  const nameHasExt = /\.[a-z0-9]{2,5}$/i.test(rawName)
  if (!nameHasExt && urlExt && urlExt.length <= 5 && urlExt !== rawName) {
    rawName = `${rawName}.${urlExt}`
  }
  const safeName = rawName.replace(/"/g, '').replace(/[\r\n]/g, '')
  const disposition = inline
    ? `inline; filename="${safeName}"`
    : `attachment; filename="${safeName}"`

  req.on('close', () => {
    if (!res.writableEnded) res.destroy()
  })

  fetchWithRedirects(rawUrl, res, disposition, MAX_REDIRECTS)
})

export default router
