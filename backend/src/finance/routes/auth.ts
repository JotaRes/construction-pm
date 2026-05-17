import { Router } from "express";
import { makeToken, verifyPassword, verifyToken } from "../lib/auth";
import { ok, fail } from "../lib/respond";

const router = Router();

router.post("/login", (req, res) => {
  try {
    const { password } = req.body || {};
    if (!password) return fail(res, "missing password", 400);
    if (!verifyPassword(password)) return fail(res, "invalid credentials", 401);
    return ok(res, { token: makeToken(password) });
  } catch (e) {
    return fail(res, e);
  }
});

router.get("/verify", (req, res) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return ok(res, { valid: verifyToken(token) });
});

export default router;
