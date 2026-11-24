import "server-only";
import { PrismaClient } from "@prisma/client";
import { prismaDatabaseUrl } from "./db-url";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({ datasourceUrl: prismaDatabaseUrl(process.env.DATABASE_URL), log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
