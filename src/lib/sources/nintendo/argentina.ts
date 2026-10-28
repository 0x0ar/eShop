import { z } from "zod";
import { fuentes } from "@config/fuentes";
import { PAISES } from "@config/regiones";
import type { TipoProducto } from "@/lib/domain/matcheo";
import { pedirJson } from "../http";
import { fechaSegura, plataformaDesdeCodigos, tipoDesdeTitulo, type ProductoCatalogo } from "./catalogo";

/**
 * Catálogo de la tienda argentina de nintendo.com (índice de Algolia
 * `store_all_products_es_ar`, verificado el 2026-10-28). Estados Unidos usa los
 * mismos nsuid, así que este catálogo también da los precios de EE. UU.
 *
 * Algolia limita a 1000 resultados por consulta, así que se recorre por
 * plataforma y por rangos de precio en ARS, partiendo cada rango hasta que
 * tenga ≤ 1000 resultados. Ver docs/fuentes.md.
 */

const hitSchema = z
  .object({
    title: z.string(),
    nsuid: z.union([z.string(), z.number()]).nullish(),
    url: z.string().nullish(),
    productImage: z.string().nullish(),
    productImageSquare: z.string().nullish(),
    softwarePublisher: z.string().nullish(),
    releaseDate: z.string().nullish(),
    platform: z.string().nullish(),
    corePlatforms: z.array(z.string()).nullish(),
    dlcType: z.string().nullish(),
    isUpgrade: z.boolean().nullish(),
    editions: z.array(z.string()).nullish(),
    popularityRank: z.number().nullish(),
    description: z.string().nullish(),
  })
  .passthrough();

export const respuestaAlgoliaSchema = z
  .object({
    hits: z.array(hitSchema),
    nbHits: z.number(),
    page: z.number(),
    nbPages: z.number(),
  })
  .passthrough();

/** Plataformas que se recorren (el índice también tiene apps de celular). */
export const PLATAFORMAS_ARGENTINA = ["Nintendo Switch", "Nintendo Switch 2"];

const BASE_IMAGEN = "https://assets.nintendo.com/image/upload/";
const SIN_RANKING = 999_999;

function imagen(hit: z.infer<typeof hitSchema>): string | null {
  if (hit.productImageSquare && /^https?:\/\//.test(hit.productImageSquare)) return hit.productImageSquare;
  const v = hit.productImage;
  if (!v) return null;
  if (/^https?:\/\//.test(v)) return v;
  return `${BASE_IMAGEN}c_fill,w_400/${v.replace(/^\//, "")}`;
}

/** Enlace a la tienda argentina y, con el mismo slug, a la de EE. UU. */
export function urlsArgentina(path: string | null | undefined): Record<string, string> {
  if (!path || !path.includes("/store/products/")) return {};
  const ar = /^https?:\/\//.test(path) ? path : `https://www.nintendo.com${path.startsWith("/") ? "" : "/"}${path}`;
  const urls: Record<string, string> = { AR: ar };
  const us = ar.replace(`/${PAISES.AR.localeSitio}/`, `/${PAISES.US.localeSitio}/`);
  if (us !== ar) urls.US = us;
  return urls;
}

function tipoBase(hit: z.infer<typeof hitSchema>): TipoProducto {
  if (hit.isUpgrade || hit.editions?.includes("Pase de mejora")) return "UPGRADE";
  switch (hit.dlcType) {
    case "ROM Bundle":
      return "BUNDLE";
    case "Individual":
    case "Paquete":
      return "DLC";
    default:
      return "JUEGO";
  }
}

export function parsearHitArgentina(hit: z.infer<typeof hitSchema>): ProductoCatalogo | null {
  const nsuid = hit.nsuid != null ? String(hit.nsuid) : null;
  if (!nsuid || !/^\d{14}$/.test(nsuid)) return null;
  const codigos = [hit.platform ?? "", ...(hit.corePlatforms ?? [])].filter(Boolean);
  if (!codigos.some((c) => /nintendo switch/i.test(c))) return null;
  const base = tipoBase(hit);
  const tipo = base === "UPGRADE" || base === "BUNDLE" ? base : tipoDesdeTitulo(hit.title, base);
  const rank = hit.popularityRank;
  return {
    nsuid,
    titulo: hit.title.trim(),
    editor: hit.softwarePublisher?.trim() || null,
    plataforma: plataformaDesdeCodigos(codigos),
    tipo,
    lanzamiento: fechaSegura(hit.releaseDate),
    imagenUrl: imagen(hit),
    descripcion: hit.description?.trim() || null,
    popularidad: rank && rank > 0 && rank < SIN_RANKING ? SIN_RANKING - rank : 0,
    urls: urlsArgentina(hit.url),
  };
}

export function parsearPaginaArgentina(json: unknown) {
  const r = respuestaAlgoliaSchema.parse(json);
  return {
    total: r.nbHits,
    paginas: r.nbPages,
    productos: r.hits.map(parsearHitArgentina).filter((p): p is ProductoCatalogo => p !== null),
  };
}

export function urlConsultaArgentina(): string {
  const cfg = fuentes.nintendoArgentina;
  return `https://${cfg.appId().toLowerCase()}-dsn.algolia.net/1/indexes/${encodeURIComponent(cfg.indice())}/query`;
}

export function headersArgentina(): Record<string, string> {
  const cfg = fuentes.nintendoArgentina;
  return {
    "Content-Type": "application/json",
    "X-Algolia-Application-Id": cfg.appId(),
    "X-Algolia-API-Key": cfg.apiKey(),
  };
}

async function consultar(cuerpo: Record<string, unknown>) {
  return pedirJson(urlConsultaArgentina(), {
    metodo: "POST",
    cuerpo: JSON.stringify(cuerpo),
    headers: headersArgentina(),
  });
}

/** Filtro de Algolia para una plataforma y un rango [min, max) de precio en ARS. */
export function filtroRango(plataforma: string, min: number, max: number): string {
  return `platform:${JSON.stringify(plataforma)} AND price.finalPrice >= ${min} AND price.finalPrice < ${max}`;
}

async function recorrerRango(
  plataforma: string,
  min: number,
  max: number,
  todos: Map<string, ProductoCatalogo>,
  limite: number | undefined,
): Promise<void> {
  if (limite && todos.size >= limite) return;
  const cfg = fuentes.nintendoArgentina;
  const filters = filtroRango(plataforma, min, max);
  const conteo = parsearPaginaArgentina(await consultar({ query: "", filters, hitsPerPage: 0 }));
  if (conteo.total === 0) return;
  // Se parte por la mitad (en centavos enteros) hasta que el rango entre en una consulta.
  if (conteo.total > cfg.limitePaginacion && max - min > 0.02) {
    const medio = Math.round(((min + max) / 2) * 100) / 100;
    await recorrerRango(plataforma, min, medio, todos, limite);
    await recorrerRango(plataforma, medio, max, todos, limite);
    return;
  }
  for (let page = 0; ; page++) {
    const pagina = parsearPaginaArgentina(
      await consultar({ query: "", filters, hitsPerPage: cfg.resultadosPorPagina, page }),
    );
    for (const p of pagina.productos) if (!todos.has(p.nsuid)) todos.set(p.nsuid, p);
    if (page + 1 >= pagina.paginas || (limite && todos.size >= limite)) break;
  }
}

/**
 * Filtro para los productos sin precio en el índice (próximos lanzamientos o
 * dados de baja): no tienen `price.finalPrice`, así que el recorrido por rangos
 * no los ve. Se excluyen todos los valores de la faceta `priceRange`.
 */
export function filtroSinPrecio(plataforma: string, rangos: string[]): string {
  return [`platform:${JSON.stringify(plataforma)}`, ...rangos.map((r) => `NOT priceRange:${JSON.stringify(r)}`)].join(
    " AND ",
  );
}

async function recorrerSinPrecio(
  plataforma: string,
  todos: Map<string, ProductoCatalogo>,
  log: (m: string) => void,
): Promise<void> {
  const cfg = fuentes.nintendoArgentina;
  const facetas = (await consultar({
    query: "",
    hitsPerPage: 0,
    filters: `platform:${JSON.stringify(plataforma)}`,
    facets: ["priceRange"],
    maxValuesPerFacet: 100,
  })) as { facets?: { priceRange?: Record<string, number> } };
  const filters = filtroSinPrecio(plataforma, Object.keys(facetas.facets?.priceRange ?? {}));
  for (let page = 0; ; page++) {
    const pagina = parsearPaginaArgentina(
      await consultar({ query: "", filters, hitsPerPage: cfg.resultadosPorPagina, page }),
    );
    if (page === 0 && pagina.total > cfg.limitePaginacion) {
      log(
        `Argentina: ${pagina.total} productos sin precio en ${plataforma}; solo se pueden bajar ${cfg.limitePaginacion}`,
      );
    }
    for (const p of pagina.productos) if (!todos.has(p.nsuid)) todos.set(p.nsuid, p);
    if (page + 1 >= pagina.paginas) break;
  }
}

export async function descargarCatalogoArgentina(opciones: { limite?: number; log?: (m: string) => void } = {}) {
  const todos = new Map<string, ProductoCatalogo>();
  for (const plataforma of PLATAFORMAS_ARGENTINA) {
    await recorrerRango(plataforma, 0, fuentes.nintendoArgentina.precioMaximo(), todos, opciones.limite);
    if (!opciones.limite || todos.size < opciones.limite) {
      await recorrerSinPrecio(plataforma, todos, opciones.log ?? (() => {}));
    }
  }
  const lista = Array.from(todos.values());
  return opciones.limite ? lista.slice(0, opciones.limite) : lista;
}
