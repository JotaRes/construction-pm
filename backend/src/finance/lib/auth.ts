import crypto from "crypto";
import { Request, Response, NextFunction } from "express";

const SECRET = process.env.JWT_SECRET || "dev-secret-financial-cfo";

export function makeToken(password: string): string {
  return crypto.createHmac("sha256", SECRET).update(password).digest("hex");
}

export function verifyPassword(password: string): boolean {
  const expected = process.env.APP_PASSWORD || "restrepo2026";
  return password === expected;
}

export function verifyToken(token: string): boolean {
  if (!token) return false;
  const expected = makeToken(process.env.APP_PASSWORD || "restrepo2026");
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
