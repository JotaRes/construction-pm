// Cliente Prisma UNIFICADO — el módulo financiero usa el mismo cliente
// que el módulo técnico, pero accede a los modelos prefijados con `fin`
// (prisma.finAccount, prisma.finMovement, etc.).
import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prismaShared: PrismaClient | undefined;
}

export const prisma =
  global.__prismaShared ||
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["error"] : ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") global.__prismaShared = prisma;
