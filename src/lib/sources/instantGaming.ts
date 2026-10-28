import * as cheerio from "cheerio";
import type Decimal from "decimal.js";
import { fuentes } from "@config/fuentes";
import { parsearPrecio } from "@/lib/domain/dinero";
import { normalizarTitulo } from "@/lib/domain/texto";

/**
 * Scraping de Instant Gaming (no tiene API pública). Todo lo que depende del
 * HTML está concentrado en `SELECTORES` y en las rutas de listado, para
 * ajustarlo en un solo lugar si cambia el sitio. Ver docs/fuentes.md.
 */

export const SELECTORES = {
  item: ".item, .search-item, article.product",
  titulo: ".title, .name, .product-title",
  precio: ".price, .final-price, [itemprop=price]",
  enlace: "a.cover, a[href*='-comprar-'], a[href*='-buy-'], a",
  agotado: ".nostock, .out-of-stock, .sold-out",
  siguiente: "a.next, .pagination a[rel=next]",
};

export const RUTAS = {
  /** Listado de productos de Nintendo Switch (keys). `{pagina}` se reemplaza. */
  keys: () => process.env.INSTANT_GAMING_RUTA_KEYS ?? "/es/busquedas/?platform%5B%5D=nintendo-switch&page={pagina}",
  /** Búsqueda de gift cards de eShop. */
  giftcards: () => process.env.INSTANT_GAMING_RUTA_GIFTCARDS ?? "/es/busquedas/?q=nintendo+eshop+card&page={pagina}",
};

export function urlListado(tipo: keyof typeof RUTAS, pagina: number): string {
  return fuentes.instantGaming.baseUrl() + RUTAS[tipo]().replace("{pagina}", String(pagina));
}

export interface ItemListado {
  titulo: string;
  precio: Decimal;
  moneda: string;
  url: string;
  disponible: boolean;
}

function monedaDeTexto(texto: string): string {
  if (/€|EUR/i.test(texto)) return "EUR";
  if (/£|GBP/i.test(texto)) return "GBP";
  if (/US\$|USD|\$/i.test(texto)) return "USD";
  return "EUR";
}

/** Extrae los productos de una página de listado/búsqueda. */
export function parsearListado(
  html: string,
  base = fuentes.instantGaming.baseUrl(),
): { items: ItemListado[]; haySiguiente: boolean } {
  const $ = cheerio.load(html);
  const items: ItemListado[] = [];
  const vistos = new Set<string>();
  $(SELECTORES.item).each((_, el) => {
    const nodo = $(el);
    const titulo =
      nodo.find(SELECTORES.titulo).first().text().trim() || nodo.find("img").first().attr("alt")?.trim() || "";
    const precioNodo = nodo.find(SELECTORES.precio).first();
    const textoPrecio = (precioNodo.attr("content") ?? precioNodo.text()).trim();
    const href = nodo.find(SELECTORES.enlace).first().attr("href");
    if (!titulo || !textoPrecio || !href) return;
    const precio = parsearPrecio(textoPrecio);
    if (!precio || precio.lte(0)) return;
    const url = new URL(href, base).toString();
    if (vistos.has(url)) return;
    vistos.add(url);
    items.push({
      titulo,
      precio,
      moneda: monedaDeTexto(precioNodo.text() + " " + (precioNodo.attr("content") ? "EUR" : "")),
      url,
      disponible: nodo.find(SELECTORES.agotado).length === 0,
    });
  });
  return { items, haySiguiente: $(SELECTORES.siguiente).length > 0 };
}

/** Región de activación declarada en el título o en el texto de la página del producto. */
export function regionActivacion(texto: string): "EU" | "US" | "GLOBAL" | null {
  const t = texto.toUpperCase();
  if (/\b(GLOBAL|WORLDWIDE|MUNDIAL)\b/.test(t)) return "GLOBAL";
  if (/\b(EUROPE|EUROPA|EU|EUR)\b/.test(t)) return "EU";
  if (/\b(NORTH AMERICA|NORTEAM[EÉ]RICA|USA|US|NA)\b/.test(t)) return "US";
  return null;
}

/** Busca la región de activación en la página de un producto. */
export function parsearRegionProducto(html: string): "EU" | "US" | "GLOBAL" | null {
  const $ = cheerio.load(html);
  const candidatos = [
    $("[class*=region]").text(),
    $("[class*=activation]").text(),
    $("body")
      .text()
      .match(/(?:regi[oó]n|region|activaci[oó]n)[^.\n]{0,80}/gi)
      ?.join(" ") ?? "",
  ];
  for (const c of candidatos) {
    const r = regionActivacion(c);
    if (r) return r;
  }
  return null;
}

const RUIDO_KEYS = [
  /\(\s*(nintendo\s+)?switch( 2)?\s*\)/gi,
  /-\s*nintendo switch( 2)?\b.*$/gi,
  /\bnintendo e-?shop\b/gi,
  /\b(key|clave|code|c[oó]digo|digital|download)\b/gi,
  /\b(europe|europa|eu|north america|usa|us|global)\b/gi,
];

/** Título de la key → título comparable con el del catálogo. */
export function limpiarTituloKey(titulo: string): string {
  let t = titulo;
  for (const r of RUIDO_KEYS) t = t.replace(r, " ");
  return normalizarTitulo(t);
}

export interface GiftCardParseada {
  valor: Decimal;
  moneda: "EUR" | "GBP" | "USD";
  region: "EU" | "GB" | "US";
}

/** Interpreta "Nintendo eShop Card 25 EUR", "Tarjeta Nintendo eShop 50€", "Nintendo eShop £15 UK", "$20 USD". */
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
