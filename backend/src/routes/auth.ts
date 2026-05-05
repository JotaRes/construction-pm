import { Router, Request, Response } from 'express'
import crypto from 'crypto'

const router = Router()

function getValidToken(): string {
  const password = process.env.APP_PASSWORD || 'construction2024'
  const secret   = process.env.JWT_SECRET   || 'pm-secret'
  return crypto.createHmac('sha256', secret).update(password).digest('hex')
}

router.post('/login', (req: Request, res: Response) => {
  const { password } = req.body as { password?: string }
  if (!password) return res.status(400).json({ error: 'Contraseña requerida' })

  if (password !== (process.env.APP_PASSWORD || 'construction2024')) {
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
