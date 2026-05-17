// Cliente Prisma del módulo FINANCIERO (separado del cliente del módulo técnico).
// Generado desde prisma/finance.prisma → output: node_modules/.prisma/finance-client
import { PrismaClient } from "../../../node_modules/.prisma/finance-client";

declare global {
  // eslint-disable-next-line no-var
  var __finPrisma: PrismaClient | undefined;
}

export const prisma =
  global.__finPrisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["error"] : ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") global.__finPrisma = prisma;
