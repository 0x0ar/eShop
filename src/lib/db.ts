import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Cliente Prisma único. El adapter se elige según DATABASE_URL:
 * `file:…` → SQLite (better-sqlite3), `postgres://…` → PostgreSQL (pg).
 * El cliente generado tiene que corresponder al mismo motor (ver prisma.config.ts).
 */
function crearCliente(): PrismaClient {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  if (/^postgres(ql)?:\/\//.test(url)) {
    return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  }
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
}

const globalParaPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db: PrismaClient = globalParaPrisma.prisma ?? crearCliente();

if (process.env.NODE_ENV !== "production") globalParaPrisma.prisma = db;

export type { PrismaClient };
