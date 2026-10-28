import "dotenv/config";
import cron from "node-cron";
import { correrJob } from "@/lib/jobs";

/**
 * Worker: corre los jobs programados con node-cron. Cada job tiene su
 * expresión cron configurable por variable de entorno. Un job no se solapa
 * consigo mismo: si la corrida anterior sigue, se saltea.
 */

const zona = process.env.TZ_WORKER || "America/Argentina/Buenos_Aires";

const PROGRAMA: { job: string; cron: string }[] = [
  { job: "cotizaciones", cron: process.env.CRON_COTIZACIONES || "*/30 * * * *" },
  { job: "catalogo", cron: process.env.CRON_CATALOGO || "0 4 * * *" },
  { job: "scrapers", cron: process.env.CRON_SCRAPERS || "30 5 * * *" },
  { job: "precios", cron: process.env.CRON_PRECIOS || "15 6,18 * * *" },
  { job: "limpieza", cron: process.env.CRON_LIMPIEZA || "0 3 * * 0" },
];

const corriendo = new Set<string>();

async function correr(job: string) {
  if (corriendo.has(job)) {
    console.log(`[worker] ${job} sigue corriendo; se saltea esta vez`);
    return;
  }
  corriendo.add(job);
  try {
    const resultados = await correrJob(job);
    for (const r of resultados) console.log(`[worker] ${r.nombre}: ${r.ok ? "ok" : "ERROR"} — ${r.mensaje}`);
  } catch (e) {
    console.error(`[worker] ${job} falló:`, e);
  } finally {
    corriendo.delete(job);
  }
}

for (const { job, cron: expr } of PROGRAMA) {
  if (!cron.validate(expr)) throw new Error(`Expresión cron inválida para ${job}: ${expr}`);
  cron.schedule(expr, () => void correr(job), { timezone: zona, name: job });
  console.log(`[worker] ${job}: "${expr}" (${zona})`);
}

// Al arrancar se actualizan las cotizaciones para no esperar al primer cron.
if (process.env.WORKER_SIN_ARRANQUE !== "1") void correr("cotizaciones");

const salir = (senal: string) => {
  console.log(`[worker] ${senal}: cerrando`);
  process.exit(0);
};
process.on("SIGINT", () => salir("SIGINT"));
process.on("SIGTERM", () => salir("SIGTERM"));
