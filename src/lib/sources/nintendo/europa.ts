import { z } from "zod";
import { fuentes } from "@config/fuentes";
import { PAISES } from "@config/regiones";
import { pedirJson } from "../http";
import { fechaSegura, plataformaDesdeCodigos, tipoDesdeTitulo, type ProductoCatalogo } from "./catalogo";

/**
 * Buscador de Nintendo Europa (Solr):
 * GET https://searching.nintendo-europe.com/{núcleo}/select?q=*&fq=type:GAME&rows=…&start=…&wt=json
 * Los nsuid son los mismos en todas las eShops europeas. Ver docs/fuentes.md.
 */

const docSchema = z
  .object({
    title: z.string(),
    type: z.string().nullish(),
    nsuid_txt: z.array(z.string()).nullish(),
    publisher: z.string().nullish(),
    system_names_txt: z.array(z.string()).nullish(),
    playable_on_txt: z.array(z.string()).nullish(),
    dates_released_dts: z.array(z.string()).nullish(),
    image_url: z.string().nullish(),
    image_url_sq_s: z.string().nullish(),
    excerpt: z.string().nullish(),
    url: z.string().nullish(),
    /** Ranking de descargas: 1 = el más descargado; 999999 = sin ranking. */
    downloads_rank_i: z.number().nullish(),
  })
  .passthrough();

export const respuestaEuropaSchema = z
  .object({
    response: z.object({
      numFound: z.number(),
      start: z.number(),
      docs: z.array(docSchema),
    }),
  })
  .passthrough();

const TIPOS_EUROPA: Record<string, "JUEGO" | "DLC"> = { GAME: "JUEGO", DLC: "DLC" };

function absoluta(url: string | null | undefined, base = "https://www.nintendo.com"): string | null {
  if (!url) return null;
  if (url.startsWith("//")) return `https:${url}`;
  if (/^https?:\/\//.test(url)) return url;
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
}

const SIN_RANKING = 999_999;

/** Ranking de descargas (1 = más popular) → puntaje creciente; sin ranking = 0. */
export function popularidadDesdeRanking(rank: number | null | undefined): number {
  if (!rank || rank <= 0 || rank >= SIN_RANKING) return 0;
  return SIN_RANKING - rank;
}

/**
 * Convierte un documento de Solr en producto. Si un documento trae varios
 * nsuid (por ejemplo físico/digital) se usa el primero que empieza con 7001
 * (prefijo de contenido descargable en la eShop).
 */
export function parsearDocumentoEuropa(doc: z.infer<typeof docSchema>, pais: string): ProductoCatalogo | null {
  const nsuids = doc.nsuid_txt ?? [];
  const nsuid = nsuids.find((n) => /^700\d{11}$/.test(n)) ?? nsuids[0];
  if (!nsuid) return null;
  const base = TIPOS_EUROPA[doc.type ?? "GAME"] ?? "JUEGO";
  const codigos = [...(doc.playable_on_txt ?? []), ...(doc.system_names_txt ?? [])];
  const url = absoluta(doc.url);
  return {
    nsuid,
    titulo: doc.title.trim(),
    editor: doc.publisher?.trim() || null,
    plataforma: plataformaDesdeCodigos(codigos),
    tipo: tipoDesdeTitulo(doc.title, base),
    lanzamiento: fechaSegura(doc.dates_released_dts?.[0]),
    imagenUrl: absoluta(doc.image_url_sq_s ?? doc.image_url, "https:"),
    descripcion: doc.excerpt?.trim() || null,
    popularidad: popularidadDesdeRanking(doc.downloads_rank_i),
    urls: url ? { [pais]: url } : {},
  };
}

export function parsearPaginaEuropa(json: unknown, pais: string) {
  const r = respuestaEuropaSchema.parse(json);
  const productos = r.response.docs
    .map((d) => parsearDocumentoEuropa(d, pais))
    .filter((p): p is ProductoCatalogo => p !== null);
  return { total: r.response.numFound, productos };
}

export function urlBusquedaEuropa(
  nucleo: string,
  tipo: "GAME" | "DLC",
  start: number,
  filas: number,
  campos?: string[],
): string {
  const u = new URL(`${fuentes.nintendoEuropa.baseUrl()}/${nucleo}/select`);
  u.searchParams.set("q", "*");
  u.searchParams.set("fq", `type:${tipo} AND nsuid_txt:*`);
  // Más descargados primero; los que no tienen ranking van al final.
  u.searchParams.set("sort", "def(downloads_rank_i,999999) asc");
  u.searchParams.set("rows", String(filas));
  u.searchParams.set("start", String(start));
  u.searchParams.set("wt", "json");
  if (campos) u.searchParams.set("fl", campos.join(","));
  return u.toString();
}

/**
 * Descarga el catálogo europeo completo desde el núcleo del país dado (por
 * defecto España, para tener títulos en español).
 */
export async function descargarCatalogoEuropa(
  opciones: { pais?: string; limite?: number; alPaginar?: (n: number, total: number) => void } = {},
) {
  const pais = opciones.pais ?? "ES";
  const nucleo = PAISES[pais]?.nucleoBusquedaEuropa ?? "es";
  const filas = fuentes.nintendoEuropa.filasPorPagina();
  const todos = new Map<string, ProductoCatalogo>();
  for (const tipo of ["GAME", "DLC"] as const) {
    let start = 0;
    let total = Infinity;
    while (start < total) {
      if (opciones.limite && todos.size >= opciones.limite) break;
      const pagina = parsearPaginaEuropa(await pedirJson(urlBusquedaEuropa(nucleo, tipo, start, filas)), pais);
      total = pagina.total;
      for (const p of pagina.productos) if (!todos.has(p.nsuid)) todos.set(p.nsuid, p);
      start += filas;
      opciones.alPaginar?.(todos.size, total);
      if (pagina.productos.length === 0) break;
    }
  }
  const lista = Array.from(todos.values());
  return opciones.limite ? lista.slice(0, opciones.limite) : lista;
}

/**
 * Solo enlaces (nsuid → url) desde el núcleo de otro país europeo, para que el
 * botón "ir a la tienda" lleve a la eShop correcta.
 */
export async function descargarEnlacesEuropa(pais: string, limite?: number): Promise<Map<string, string>> {
  const nucleo = PAISES[pais]?.nucleoBusquedaEuropa;
  if (!nucleo) return new Map();
  const filas = fuentes.nintendoEuropa.filasPorPagina();
  const enlaces = new Map<string, string>();
  for (const tipo of ["GAME", "DLC"] as const) {
    let start = 0;
    let total = Infinity;
    while (start < total && (!limite || enlaces.size < limite)) {
      const json = await pedirJson(urlBusquedaEuropa(nucleo, tipo, start, filas, ["title", "nsuid_txt", "url"]));
      const r = respuestaEuropaSchema.parse(json);
      total = r.response.numFound;
      for (const d of r.response.docs) {
        const p = parsearDocumentoEuropa(d, pais);
        if (p?.urls[pais]) enlaces.set(p.nsuid, p.urls[pais]);
      }
      start += filas;
      if (r.response.docs.length === 0) break;
    }
  }
  return enlaces;
}
