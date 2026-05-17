import { Response } from "express";

export const ok = <T>(res: Response, data: T) => res.json({ data, error: null });
export const fail = (res: Response, error: unknown, status = 500) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[api error]", message);
  return res.status(status).json({ data: null, error: message });
};
