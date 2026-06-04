import crypto from "crypto";
import { Request, Response, NextFunction } from "express";

// Los fallbacks DEBEN coincidir con los de routes/auth.ts (login técnico).
// El token global = HMAC-SHA256(JWT_SECRET, APP_PASSWORD). Si estos valores de
// respaldo divergieran y faltara alguna env var, el login emitiría un token que
// requireAuth rechazaría → 401 en TODO el sistema. Mantenerlos idénticos lo evita.
const SECRET = process.env.JWT_SECRET || "pm-secret";

export function makeToken(password: string): string {
  return crypto.createHmac("sha256", SECRET).update(password).digest("hex");
}

export function verifyPassword(password: string): boolean {
  const expected = process.env.APP_PASSWORD || "construction2024";
  return password === expected;
}

export function verifyToken(token: string): boolean {
  if (!token) return false;
  const expected = makeToken(process.env.APP_PASSWORD || "construction2024");
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.path === "/auth/login" || req.path === "/health") return next();
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!verifyToken(token)) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}
