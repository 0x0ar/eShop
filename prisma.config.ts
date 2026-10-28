import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { defineConfig } from "prisma/config";

/**
 * Un solo schema (prisma/schema.prisma, provider sqlite). Si DATABASE_URL es
 * Postgres se genera prisma/postgres/schema.prisma con el provider cambiado y
 * Prisma usa ese archivo. Ver docs/decisiones.md.
 */
const url = process.env.DATABASE_URL ?? "file:./dev.db";
const esPostgres = /^postgres(ql)?:\/\//.test(url);

let schema = "prisma/schema.prisma";
if (esPostgres) {
  const original = readFileSync(schema, "utf8");
  const derivado = original
    .replace('provider = "sqlite"', 'provider = "postgresql"')
    .replace('output   = "../src/generated/prisma"', 'output   = "../../src/generated/prisma"');
  mkdirSync("prisma/postgres", { recursive: true });
  writeFileSync("prisma/postgres/schema.prisma", `// ARCHIVO GENERADO por prisma.config.ts — no editar.\n${derivado}`);
  schema = "prisma/postgres/schema.prisma";
}

export default defineConfig({
  schema,
  datasource: { url },
});
