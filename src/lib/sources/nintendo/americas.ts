import { z } from "zod";
import { fuentes } from "@config/fuentes";
import { PAISES } from "@config/regiones";
import { pedirJson } from "../http";
import { fechaSegura, plataformaDesdeCodigos, tipoDesdeTitulo, type ProductoCatalogo } from "./catalogo";

/**
 * Índice de Algolia que usa nintendo.com (catálogo de América: EE. UU. y
 * Argentina comparten nsuid). Credenciales públicas de solo búsqueda, embebidas
 * en el sitio de Nintendo. Ver docs/fuentes.md.
 *
 * Algolia limita a 1000 resultados por consulta, así que el catálogo se parte
 * en rangos de precio (y por plataforma) hasta que cada parte tenga ≤ 1000.
 */

const hitSchema = z
  .object({
    objectID: z.string().optional(),
    title: z.string(),
    nsuid: z.union([z.string(), z.number()]).nullish(),
    url: z.string().nullish(),
    productImage: z.union([z.string(), z.object({ url: z.string().optional() }).passthrough()]).nullish(),
    softwarePublisher: z.string().nullish(),
    releaseDate: z.string().nullish(),
    platformCode: z.string().nullish(),
    corePlatforms: z.array(z.string()).nullish(),
    topLevelCategoryCode: z.string().nullish(),
    topLevelFilters: z.array(z.string()).nullish(),
    dlcType: z.string().nullish(),
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

const BASE_IMAGEN = "https://assets.nintendo.com/image/upload/";

function imagen(valor: z.infer<typeof hitSchema>["productImage"]): string | null {
  const v = typeof valor === "string" ? valor : valor?.url;
  if (!v) return null;
  if (/^https?:\/\//.test(v)) return v;
  return `${BASE_IMAGEN}c_fill,w_400/${v.replace(/^\//, "")}`;
}

export function urlsAmericas(path: string | null | undefined): Record<string, string> {
  if (!path) return {};
  const abs = /^https?:\/\//.test(path) ? path : `https://www.nintendo.com${path.startsWith("/") ? "" : "/"}${path}`;
  const urls: Record<string, string> = { US: abs };
  // nintendo.com usa el mismo slug con otro prefijo de locale para Argentina.
  const ar = abs.replace(/nintendo\.com\/(us|en-us)\//, `nintendo.com/${PAISES.AR.localeSitio}/`);
  if (ar !== abs) urls.AR = ar;
  return urls;
}

export function parsearHitAmericas(hit: z.infer<typeof hitSchema>): ProductoCatalogo | null {
  const nsuid = hit.nsuid != null ? String(hit.nsuid) : null;
  if (!nsuid || !/^\d{14}$/.test(nsuid)) return null;
  const categoria = (hit.topLevelCategoryCode ?? "").toUpperCase();
  const esDlc = categoria === "DLC" || Boolean(hit.dlcType) || (hit.topLevelFilters ?? []).includes("DLC");
  const codigos = [hit.platformCode ?? "", ...(hit.corePlatforms ?? [])].filter(Boolean);
  return {
    nsuid,
    titulo: hit.title.trim(),
    editor: hit.softwarePublisher?.trim() || null,
    plataforma: plataformaDesdeCodigos(codigos),
    tipo: tipoDesdeTitulo(hit.title, esDlc ? "DLC" : "JUEGO"),
    lanzamiento: fechaSegura(hit.releaseDate),
    imagenUrl: imagen(hit.productImage),
    descripcion: hit.description?.trim() || null,
    popularidad: 0,
    urls: urlsAmericas(hit.url),
  };
}

export function parsearPaginaAmericas(json: unknown) {
  const r = respuestaAlgoliaSchema.parse(json);
  return {
    total: r.nbHits,
    paginas: r.nbPages,
    productos: r.hits.map(parsearHitAmericas).filter((p): p is ProductoCatalogo => p !== null),
  };
}

async function consultar(cuerpo: Record<string, unknown>) {
  const cfg = fuentes.nintendoAmericas;
  const url = `https://${cfg.appId().toLowerCase()}-dsn.algolia.net/1/indexes/${encodeURIComponent(cfg.indice())}/query`;
  return pedirJson(url, {
    metodo: "POST",
    cuerpo: JSON.stringify(cuerpo),
    headers: {
      "Content-Type": "application/json",
      "X-Algolia-Application-Id": cfg.appId(),
      "X-Algolia-API-Key": cfg.apiKey(),
    },
  });
}

/** Rango de precio [min, max) en USD; se parte a la mitad si tiene más de 1000 resultados. */
async function recorrerRango(
  filtros: string,
  min: number,
  max: number,
  todos: Map<string, ProductoCatalogo>,
  limite: number | undefined,
): Promise<void> {
  if (limite && todos.size >= limite) return;
  const numericFilters = [`price.finalPrice>=${min}`, `price.finalPrice<${max}`];
  const conteo = parsearPaginaAmericas(await consultar({ query: "", filters: filtros, numericFilters, hitsPerPage: 0 }));
  if (conteo.total === 0) return;
  if (conteo.total > fuentes.nintendoAmericas.limitePaginacion && max - min > 0.02) {
    const medio = Math.round(((min + max) / 2) * 100) / 100;
    await recorrerRango(filtros, min, medio, todos, limite);
    await recorrerRango(filtros, medio, max, todos, limite);
    return;
  }
  for (let page = 0; ; page++) {
    const pagina = parsearPaginaAmericas(
      await consultar({ query: "", filters: filtros, numericFilters, hitsPerPage: 500, page }),
    );
    for (const p of pagina.productos) if (!todos.has(p.nsuid)) todos.set(p.nsuid, p);
    if (page + 1 >= pagina.paginas || (limite && todos.size >= limite)) break;
  }
}

export async function descargarCatalogoAmericas(opciones: { limite?: number } = {}) {
  const todos = new Map<string, ProductoCatalogo>();
  for (const plataforma of ["NINTENDO_SWITCH", "NINTENDO_SWITCH_2"]) {
    await recorrerRango(`platformCode:${plataforma}`, 0, 1000, todos, opciones.limite);
  }
  const lista = Array.from(todos.values());
  return opciones.limite ? lista.slice(0, opciones.limite) : lista;
}
