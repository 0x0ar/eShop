import { db } from "@/lib/db";
import type { CacheHttp } from "@/lib/sources/http";

export interface ContextoJob {
  log: (mensaje: string) => void;
  /** Suma ítems procesados (se guarda en la ejecución). */
  contar: (n?: number) => void;
}

export type FuncionJob = (ctx: ContextoJob) => Promise<string | void>;

function marcaTiempo() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

/**
 * Corre un job registrando inicio, fin, ítems y error en EjecucionJob, con
 * logs prefijados por el nombre del job.
 */
export async function ejecutarJob(nombre: string, fn: FuncionJob): Promise<{ ok: boolean; mensaje: string; items: number }> {
  const log = (m: string) => console.log(`[${marcaTiempo()}] [${nombre}] ${m}`);
  let items = 0;
  const ejecucion = await db.ejecucionJob.create({ data: { job: nombre, estado: "corriendo" } });
  log("inicio");
  try {
    const mensaje = (await fn({ log, contar: (n = 1) => (items += n) })) ?? "ok";
    await db.ejecucionJob.update({ where: { id: ejecucion.id }, data: { estado: "ok", fin: new Date(), items, mensaje } });
    log(`fin: ${mensaje} (${items} ítems)`);
    return { ok: true, mensaje, items };
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    console.error(`[${marcaTiempo()}] [${nombre}] ERROR: ${mensaje}`, e instanceof Error ? e.stack : "");
    await db.ejecucionJob.update({
      where: { id: ejecucion.id },
      data: { estado: "error", fin: new Date(), items, mensaje: mensaje.slice(0, 2000) },
    });
    return { ok: false, mensaje, items };
  }
}

export async function registrarExito(fuente: string, detalle?: string) {
  const ahora = new Date();
  await db.estadoFuente.upsert({
    where: { fuente },
    create: { fuente, ultimoExito: ahora, detalle: detalle ?? null },
    update: { ultimoExito: ahora, detalle: detalle ?? null },
  });
}

export async function registrarError(fuente: string, error: unknown) {
  const ahora = new Date();
  const mensaje = (error instanceof Error ? error.message : String(error)).slice(0, 1000);
  await db.estadoFuente.upsert({
    where: { fuente },
    create: { fuente, ultimoError: ahora, error: mensaje },
    update: { ultimoError: ahora, error: mensaje },
  });
}

/** Caché HTTP persistente en la tabla HttpCache. */
export const cacheHttpDb: CacheHttp = {
  async leer(url) {
    return db.httpCache.findUnique({ where: { url } });
  },
  async guardar(url, estado, cuerpo) {
    const obtenido = new Date();
    await db.httpCache.upsert({ where: { url }, create: { url, estado, cuerpo, obtenido }, update: { estado, cuerpo, obtenido } });
  },
};
