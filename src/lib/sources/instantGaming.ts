import * as cheerio from "cheerio";
import type Decimal from "decimal.js";
import { fuentes } from "@config/fuentes";
import { PAISES } from "@config/regiones";
import { dec, parsearPrecio } from "@/lib/domain/dinero";
import { normalizarTitulo } from "@/lib/domain/texto";

/**
 * Scraping de Instant Gaming (no tiene API pública). Verificado el 2026-10-28
 * con páginas reales (tests/fixtures/real/instant-gaming-*.html):
 *
 * - robots.txt PROHÍBE la búsqueda (/es/busquedas/). El listado completo de la
 *   tienda solo existe ahí (lo arma el navegador consultando Algolia), así que
 *   no se usa.
 * - Las categorías (/es/nintendo/…) y las fichas de producto están permitidas.
 *   Las categorías traen en el HTML solo productos destacados; de ahí salen los
 *   enlaces a fichas.
 * - Cada ficha trae `window.productModel` (precio, stock) y
 *   `window.countriesAvailability` (países donde se activa). Con eso no hace
 *   falta adivinar la región de activación.
 */

export const RUTAS = {
  /** Categorías permitidas de donde se sacan enlaces a fichas de juegos. */
  categoriasKeys: (): string[] =>
    (
      process.env.INSTANT_GAMING_CATEGORIAS ??
      "/es/nintendo/switch/,/es/nintendo/switch2/,/es/nintendo/tendencias/,/es/nintendo/mas-vendidos/"
    )
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  /** Punto de partida para gift cards; desde cada ficha se siguen sus variantes. */
  giftcards: () => process.env.INSTANT_GAMING_RUTA_GIFTCARDS ?? "/es/nintendo/tarjetas-regalo/",
};

export function urlInstantGaming(ruta: string): string {
  return new URL(ruta, fuentes.instantGaming.baseUrl()).toString();
}

const RE_FICHA = /^\/[a-z]{2}\/\d+-(?:comprar|descargar)-[a-z0-9-]+\/?$/;
const RE_GIFTCARD = /tarjeta-nintendo-eshop|nintendo-eshop-card|eshop-card/;

function absolutaIG(href: string, base: string): URL | null {
  try {
    const u = new URL(href, base);
    return u.hostname.endsWith("instant-gaming.com") ? u : null;
  } catch {
    return null;
  }
}

/** Enlaces a fichas de producto presentes en una página. */
export function enlacesFichas(html: string, base = fuentes.instantGaming.baseUrl()): string[] {
  const $ = cheerio.load(html);
  const urls = new Set<string>();
  $("a[href]").each((_, a) => {
    const u = absolutaIG($(a).attr("href")!, base);
    if (u && RE_FICHA.test(u.pathname)) urls.add(`${u.origin}${u.pathname}`);
  });
  return Array.from(urls);
}

export function esFichaGiftCard(url: string): boolean {
  return RE_GIFTCARD.test(url);
}

/** Subcategorías de géneros de Nintendo (también permitidas) para ampliar el descubrimiento. */
export function enlacesGeneros(html: string, base = fuentes.instantGaming.baseUrl()): string[] {
  const $ = cheerio.load(html);
  const urls = new Set<string>();
  $("a[href]").each((_, a) => {
    const u = absolutaIG($(a).attr("href")!, base);
    if (u && /^\/[a-z]{2}\/nintendo\/generos\/[a-z0-9-]+\/$/.test(u.pathname)) urls.add(`${u.origin}${u.pathname}`);
  });
  return Array.from(urls);
}

/** Nombre de país en español (como lo muestra Instant Gaming) → código de las eShops configuradas. */
const CODIGO_POR_NOMBRE = new Map(Object.values(PAISES).map((p) => [p.nombre.toLowerCase(), p.codigo]));

export interface FichaIG {
  prodId: number;
  url: string;
  /** Título del producto (h1), por ejemplo "Sonic Origins Plus - Switch". */
  titulo: string;
  /** Título con región, por ejemplo "Sonic Origins Plus - Switch - Europe". */
  tituloCompleto: string;
  precio: Decimal;
  moneda: string;
  disponible: boolean;
  /** Países donde se activa, tal como los lista la tienda. */
  paisesTienda: string[];
  /** Códigos de las eShops configuradas donde se activa (subconjunto de paisesTienda). */
  paisesActivacion: string[];
  esNintendo: boolean;
}

function extraerJson<T>(html: string, variable: string): T | null {
  // window.x = {...}; window.y = …  → se toma hasta el próximo "; window." o fin de script.
  const inicio = html.indexOf(`window.${variable} = `);
  if (inicio < 0) return null;
  const desde = inicio + `window.${variable} = `.length;
  const fin = html.indexOf(";", desde);
  for (let corte = fin; corte > 0 && corte < html.length; corte = html.indexOf(";", corte + 1)) {
    try {
      return JSON.parse(html.slice(desde, corte)) as T;
    } catch {
      if (corte - desde > 2_000_000) return null;
    }
  }
  return null;
}

function monedaDeFormato(formato: string | undefined): string {
  if (!formato) return "EUR";
  if (/€|\\u20ac/i.test(formato)) return "EUR";
  if (/£|\\u00a3/i.test(formato)) return "GBP";
  if (/\$/.test(formato)) return "USD";
  return "EUR";
}

/** Parsea una ficha de producto. Devuelve null si la página no tiene los datos esperados. */
export function parsearFicha(html: string): FichaIG | null {
  const modelo = extraerJson<{
    prod_id?: number;
    price?: number | string;
    has_stock?: boolean;
    retail_currency_format?: string;
  }>(html, "productModel");
  if (!modelo?.prod_id || modelo.price == null) return null;
  const $ = cheerio.load(html);
  const titulo = $("h1").first().text().replace(/\s+/g, " ").trim();
  const og =
    $('meta[property="og:title"]')
      .attr("content")
      ?.replace(/^Comprar\s+/i, "")
      .trim() ?? titulo;
  const url = $('link[rel="canonical"]').attr("href") ?? "";
  const paisesTienda = extraerJson<string[]>(html, "countriesAvailability") ?? [];
  const paisesActivacion = Array.from(
    new Set(paisesTienda.map((n) => CODIGO_POR_NOMBRE.get(n.toLowerCase())).filter((c): c is string => Boolean(c))),
  );
  const migas = $('script[type="application/ld+json"]').text();
  return {
    prodId: modelo.prod_id,
    url,
    titulo: titulo || og,
    tituloCompleto: og,
    precio: dec(String(modelo.price)),
    moneda: monedaDeFormato(modelo.retail_currency_format),
    disponible: modelo.has_stock !== false,
    paisesTienda,
    paisesActivacion,
    esNintendo: /\/nintendo\//.test(migas) || /nintendo-eshop/.test(url),
  };
}

/**
 * Etiqueta de región a partir de los países de activación: EU si son todos
 * europeos, US si es solo Estados Unidos, GLOBAL si mezcla regiones.
 */
export function etiquetaRegion(paises: string[]): "EU" | "US" | "GLOBAL" | null {
  if (paises.length === 0) return null;
  const americanos = paises.filter((p) => PAISES[p]?.catalogo === "AMERICAS");
  if (americanos.length === 0) return "EU";
  if (americanos.length === paises.length) return americanos.every((p) => p === "US") ? "US" : "GLOBAL";
  return "GLOBAL";
}

const RUIDO_KEYS = [
  /\(\s*(nintendo\s+)?switch( 2)?\s*\)/gi,
  /\s[-–]\s*(nintendo\s+)?switch( 2)?\b.*$/gi,
  /\bnintendo e-?shop\b/gi,
  /\b(key|clave|code|c[oó]digo|digital|download)\b/gi,
  /\b(europe|europa|north america|usa|global)\b/gi,
];

/** Título de la key → título comparable con el del catálogo. */
export function limpiarTituloKey(titulo: string): string {
  let t = titulo;
  for (const r of RUIDO_KEYS) t = t.replace(r, " ");
  return normalizarTitulo(t);
}

/** "Sonic Origins Plus - Switch 2" → SWITCH2; "- Switch" → SWITCH; sin dato → null. */
export function plataformaDeTitulo(titulo: string): "SWITCH" | "SWITCH2" | null {
  if (/switch\s*2\b/i.test(titulo)) return "SWITCH2";
  if (/\bswitch\b/i.test(titulo)) return "SWITCH";
  return null;
}

export interface GiftCardParseada {
  valor: Decimal;
  moneda: "EUR" | "GBP" | "USD";
  region: "EU" | "GB" | "US";
}

/**
 * Interpreta "Tarjeta Nintendo eShop 20$", "Tarjeta Nintendo eShop 25GBP",
 * "Nintendo eShop Card 25 EUR", "£15", "$20 USD".
 */
export function parsearTituloGiftCard(titulo: string): GiftCardParseada | null {
  if (!/e-?shop|nintendo/i.test(titulo) || !/card|tarjeta|gift|saldo|cr[eé]dito|prepaid|prepago/i.test(titulo))
    return null;
  const patrones: [RegExp, GiftCardParseada["moneda"]][] = [
    [/(\d+(?:[.,]\d{1,2})?)\s*(?:€|eur\b|euros?\b)/i, "EUR"],
    [/(?:€)\s*(\d+(?:[.,]\d{1,2})?)/i, "EUR"],
    [/(?:£)\s*(\d+(?:[.,]\d{1,2})?)/i, "GBP"],
    [/(\d+(?:[.,]\d{1,2})?)\s*(?:£|gbp\b)/i, "GBP"],
    [/(?:US\$|\$)\s*(\d+(?:[.,]\d{1,2})?)/i, "USD"],
    [/(\d+(?:[.,]\d{1,2})?)\s*(?:usd\b|\$|dollars?\b|d[oó]lares\b)/i, "USD"],
  ];
  for (const [re, moneda] of patrones) {
    const m = titulo.match(re);
    if (!m) continue;
    const valor = parsearPrecio(m[1]);
    if (!valor || valor.lte(0)) continue;
    const region = moneda === "EUR" ? "EU" : moneda === "GBP" ? "GB" : "US";
    return { valor, moneda, region };
  }
  return null;
}
