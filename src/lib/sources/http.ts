import { fuentes } from "@config/fuentes";
import { permitidoPorRobots, parsearRobots, type ReglasRobots } from "./robots";

/**
 * Capa HTTP compartida por todas las fuentes:
 * - User-Agent identificable
 * - intervalo mínimo entre requests al mismo host (más largo para scraping)
 * - reintentos con backoff ante errores de red o 5xx/429
 * - timeout
 * - para scraping: respeta robots.txt y usa una caché persistente
 */

export class ErrorHttp extends Error {
  constructor(
    public url: string,
    public estado: number,
    mensaje?: string,
  ) {
    super(mensaje ?? `HTTP ${estado} en ${url}`);
  }
}

export class BloqueadoPorRobotsError extends Error {
  constructor(public url: string) {
    super(`robots.txt no permite ${url}`);
  }
}

/** Caché persistente para scraping. Se inyecta para poder testear sin base. */
export interface CacheHttp {
  leer(url: string): Promise<{ estado: number; cuerpo: string; obtenido: Date } | null>;
  guardar(url: string, estado: number, cuerpo: string): Promise<void>;
}

const ultimoPedido = new Map<string, number>();
const colas = new Map<string, Promise<void>>();

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Serializa los pedidos por host respetando el intervalo mínimo. */
async function turno(host: string, intervaloMs: number): Promise<void> {
  const anterior = colas.get(host) ?? Promise.resolve();
  let liberar!: () => void;
  const actual = new Promise<void>((r) => (liberar = r));
  colas.set(
    host,
    anterior.then(() => actual),
  );
  await anterior;
  const espera = (ultimoPedido.get(host) ?? 0) + intervaloMs - Date.now();
  if (espera > 0) await esperar(espera);
  ultimoPedido.set(host, Date.now());
  liberar();
}

export interface OpcionesPedido {
  metodo?: "GET" | "POST";
  cuerpo?: string;
  headers?: Record<string, string>;
  /** Intervalo mínimo entre pedidos al host. */
  intervaloMs?: number;
  reintentos?: number;
  timeoutMs?: number;
  /** Estados que no son error (por ejemplo 404 cuando se prueba si existe una ruta). */
  aceptar?: number[];
}

/** `fetch failed` no dice nada: se agrega la causa (DNS, conexión rechazada, timeout…). */
function conCausa(e: unknown, url: string): unknown {
  if (!(e instanceof Error) || e instanceof ErrorHttp) return e;
  // undici anida causas (DOMException → RequestAbortedError…): se toma la más profunda.
  let causa: unknown = (e as Error & { cause?: unknown }).cause;
  while (causa instanceof Error && (causa as Error & { cause?: unknown }).cause)
    causa = (causa as Error & { cause?: unknown }).cause;
  const detalle = causa instanceof Error ? causa.message : causa ? String(causa) : null;
  return new Error(
    `${e.name === "TimeoutError" ? "Timeout" : e.message}${detalle ? ` (${detalle})` : ""} en ${new URL(url).host}`,
  );
}

export async function pedir(url: string, op: OpcionesPedido = {}): Promise<{ estado: number; cuerpo: string }> {
  const host = new URL(url).host;
  const reintentos = op.reintentos ?? 2;
  let ultimoError: unknown;
  for (let intento = 0; intento <= reintentos; intento++) {
    await turno(host, op.intervaloMs ?? fuentes.apiIntervaloMinimoMs());
    try {
      const res = await fetch(url, {
        method: op.metodo ?? "GET",
        body: op.cuerpo,
        headers: {
          "User-Agent": fuentes.scraping.userAgent(),
          "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
          ...op.headers,
        },
        signal: AbortSignal.timeout(op.timeoutMs ?? 20_000),
        redirect: "follow",
      });
      const cuerpo = await res.text();
      if (res.ok || op.aceptar?.includes(res.status)) return { estado: res.status, cuerpo };
      ultimoError = new ErrorHttp(url, res.status);
      if (res.status !== 429 && res.status < 500) throw ultimoError;
    } catch (e) {
      if (e instanceof ErrorHttp && e.estado !== 429 && e.estado < 500) throw e;
      ultimoError = conCausa(e, url);
    }
    if (intento < reintentos) await esperar(1000 * 2 ** intento);
  }
  throw ultimoError instanceof Error ? ultimoError : new Error(String(ultimoError));
}

export async function pedirJson<T = unknown>(url: string, op: OpcionesPedido = {}): Promise<T> {
  const { cuerpo } = await pedir(url, { ...op, headers: { Accept: "application/json", ...op.headers } });
  try {
    return JSON.parse(cuerpo) as T;
  } catch {
    throw new Error(`Respuesta no es JSON en ${url}: ${cuerpo.slice(0, 120)}`);
  }
}

const robotsPorHost = new Map<string, { reglas: ReglasRobots; obtenido: number }>();

async function reglasRobots(origen: string): Promise<ReglasRobots> {
  const cache = robotsPorHost.get(origen);
  if (cache && Date.now() - cache.obtenido < 6 * 3600_000) return cache.reglas;
  let reglas: ReglasRobots;
  try {
    const { estado, cuerpo } = await pedir(`${origen}/robots.txt`, {
      intervaloMs: fuentes.scraping.intervaloMinimoMs(),
      aceptar: [404, 410],
    });
    reglas = estado >= 400 ? parsearRobots("") : parsearRobots(cuerpo);
  } catch (e) {
    // Si no se puede leer robots.txt, no se scrapea (criterio conservador).
    throw new Error(`No se pudo leer ${origen}/robots.txt: ${(e as Error).message}`);
  }
  robotsPorHost.set(origen, { reglas, obtenido: Date.now() });
  return reglas;
}

/**
 * GET para scraping: verifica robots.txt, usa la caché persistente si es
 * reciente y espera el intervalo de scraping entre pedidos al mismo host.
 */
export async function pedirPagina(
  url: string,
  cache: CacheHttp | null,
  ttlMs = fuentes.scraping.ttlCacheMs(),
): Promise<string> {
  if (cache) {
    const guardada = await cache.leer(url);
    if (guardada && Date.now() - guardada.obtenido.getTime() < ttlMs && guardada.estado < 400) return guardada.cuerpo;
  }
  const u = new URL(url);
  const reglas = await reglasRobots(u.origin);
  if (!permitidoPorRobots(reglas, fuentes.scraping.userAgent(), u.pathname + u.search)) {
    throw new BloqueadoPorRobotsError(url);
  }
  const { estado, cuerpo } = await pedir(url, {
    intervaloMs: Math.max(fuentes.scraping.intervaloMinimoMs(), reglas.crawlDelayMs ?? 0),
    headers: { Accept: "text/html,application/xhtml+xml" },
  });
  if (cache) await cache.guardar(url, estado, cuerpo);
  return cuerpo;
}
