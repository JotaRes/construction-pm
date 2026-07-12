import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import { env } from "../../lib/env";

// SIN FALLBACKS: JWT_SECRET y APP_PASSWORD son obligatorios y se validan al
// arranque (lib/env.ts). El token global = HMAC-SHA256(JWT_SECRET, APP_PASSWORD)
// y debe generarse idéntico aquí y en routes/auth.ts (login técnico).

export function makeToken(password: string): string {
  return crypto.createHmac("sha256", env.JWT_SECRET).update(password).digest("hex");
}

export function verifyPassword(password: string): boolean {
  const expected = Buffer.from(env.APP_PASSWORD);
  const given = Buffer.from(password);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

export function verifyToken(token: string): boolean {
  if (!token) return false;
  const expected = makeToken(env.APP_PASSWORD);
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
