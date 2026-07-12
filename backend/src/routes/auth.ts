import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import { env } from '../lib/env'

const router = Router()

// SIN FALLBACKS: JWT_SECRET y APP_PASSWORD son obligatorios (validados al
// arranque en lib/env.ts). Nunca reintroducir valores por defecto aquí —
// un fallback hardcodeado en un repo es una credencial pública.
function getValidToken(): string {
  return crypto.createHmac('sha256', env.JWT_SECRET).update(env.APP_PASSWORD).digest('hex')
}

router.post('/login', (req: Request, res: Response) => {
  const { password } = req.body as { password?: string }
  if (!password) return res.status(400).json({ error: 'Contraseña requerida' })

  // Comparación timing-safe también en el login
  const expected = Buffer.from(env.APP_PASSWORD)
  const given = Buffer.from(password)
  const match = expected.length === given.length && crypto.timingSafeEqual(expected, given)
  if (!match) {
    return res.status(401).json({ error: 'Contraseña incorrecta' })
  }

  res.json({ token: getValidToken() })
})

router.get('/verify', (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ valid: false })
  res.json({ valid: token === getValidToken() })
})

export default router
