import { Router, Request, Response } from 'express'
import https from 'https'

const router = Router()

// Only allow proxying from trusted file-storage hosts
const ALLOWED_HOSTS = ['res.cloudinary.com', 'cloudinary.com']

router.get('/', (req: Request, res: Response) => {
  const rawUrl = req.query.url as string
  const inline = req.query.inline === '1'

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

  if (!ALLOWED_HOSTS.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h))) {
    res.status(403).json({ error: 'URL host not allowed' })
    return
  }

  const rawName = decodeURIComponent(parsed.pathname.split('/').pop() ?? 'download')
  const disposition = inline ? `inline; filename="${rawName}"` : `attachment; filename="${rawName}"`

  const proxyReq = https.get(rawUrl, (proxyRes) => {
    const ct = proxyRes.headers['content-type']
    if (ct) res.setHeader('Content-Type', ct)
    res.setHeader('Content-Disposition', disposition)
    res.setHeader('Cache-Control', 'private, max-age=3600')
    res.status(proxyRes.statusCode ?? 200)
    proxyRes.pipe(res)
  })

  proxyReq.on('error', (err) => {
    console.error('Download proxy error:', err)
    if (!res.headersSent) res.status(502).json({ error: `Upstream error: ${err.message}` })
    else res.destroy()
  })
})

export default router
