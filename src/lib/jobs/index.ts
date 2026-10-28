import { db } from "@/lib/db";
import { revisarAlertas } from "@/lib/alertas";
import { jobCatalogo, rematchear } from "./catalogo";
import { jobCotizaciones } from "./cotizaciones";
import { jobPopulares, jobPrecios } from "./precios";
import { jobResumen } from "./resumen";
import { ejecutarJob, type FuncionJob } from "./runner";
import { jobScrapers } from "./scrapers";

const jobAlertas: FuncionJob = async ({ log, contar }) => {
  const n = await revisarAlertas(log);
  contar(n);
  return `${n} avisos`;
};

const jobLimpieza: FuncionJob = async ({ log }) => {
  const hace = (dias: number) => new Date(Date.now() - dias * 86_400_000);
  const cache = await db.httpCache.deleteMany({ where: { obtenido: { lt: hace(7) } } });
  const ejecuciones = await db.ejecucionJob.deleteMany({ where: { inicio: { lt: hace(30) } } });
  const pendientes = await db.alerta.deleteMany({ where: { estado: "pendiente", creada: { lt: hace(7) } } });
  log(`Caché: ${cache.count}, ejecuciones: ${ejecuciones.count}, alertas sin confirmar: ${pendientes.count}`);
  return "ok";
};

export interface DefinicionJob {
  descripcion: string;
  /** Jobs que corren después (por ejemplo, alertas después de precios). */
  despues?: string[];
  fn: FuncionJob;
}

export const JOBS: Record<string, DefinicionJob> = {
  cotizaciones: { descripcion: "Dólar/euro oficial y blue (DolarAPI) y cruzadas (Frankfurter)", fn: jobCotizaciones },
  catalogo: { descripcion: "Catálogos de América y Europa + matcheo entre regiones", fn: jobCatalogo },
  rematchear: { descripcion: "Rehace el matcheo con lo guardado (tras cargar overrides)", fn: rematchear },
  precios: { descripcion: "Precios de todas las eShops configuradas", fn: jobPrecios, despues: ["resumen", "alertas"] },
  populares: {
    descripcion: "Precios solo de los juegos más populares (POPULARES_CANTIDAD)",
    fn: jobPopulares(),
    despues: ["resumen", "alertas"],
  },
  scrapers: {
    descripcion: "Keys y gift cards (Instant Gaming y demás proveedores)",
    fn: jobScrapers,
    despues: ["resumen"],
  },
  resumen: { descripcion: "Recalcula el mejor precio en ARS de cada juego", fn: jobResumen },
  alertas: { descripcion: "Revisa alertas y manda avisos", fn: jobAlertas },
  limpieza: { descripcion: "Borra caché HTTP vieja, logs viejos y alertas sin confirmar", fn: jobLimpieza },
};

/** Orden de la carga completa. */
export const SECUENCIA_TODO = ["cotizaciones", "catalogo", "precios", "scrapers"];

/** Corre un job y los que dependen de él. `todo` corre la secuencia completa. */
export async function correrJob(nombre: string): Promise<{ nombre: string; ok: boolean; mensaje: string }[]> {
  if (nombre === "todo") {
    const resultados = [];
    for (const n of SECUENCIA_TODO) resultados.push(...(await correrJob(n)));
    return resultados;
  }
  const def = JOBS[nombre];
  if (!def) throw new Error(`Job desconocido: ${nombre}. Disponibles: ${Object.keys(JOBS).join(", ")}, todo`);
  const r = await ejecutarJob(nombre, def.fn);
  const resultados = [{ nombre, ok: r.ok, mensaje: r.mensaje }];
  if (r.ok) {
    for (const siguiente of def.despues ?? []) {
      const s = await ejecutarJob(siguiente, JOBS[siguiente].fn);
      resultados.push({ nombre: siguiente, ok: s.ok, mensaje: s.mensaje });
    }
  }
  return resultados;
}
