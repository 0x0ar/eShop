import { z } from "zod";
import type Decimal from "decimal.js";
import { fuentes } from "@config/fuentes";
import { parsearPrecio } from "@/lib/domain/dinero";
import { pedirJson } from "../http";

/**
 * API de precios de la eShop (no oficial, sin autenticación):
 * GET https://api.ec.nintendo.com/v1/price?country=AR&lang=es&ids=7001…,7001…
 * Ver docs/fuentes.md.
 */

const montoSchema = z
  .object({
    amount: z.string().optional(),
    currency: z.string(),
    raw_value: z.string(),
    start_datetime: z.string().optional(),
    end_datetime: z.string().optional(),
  })
  .passthrough();

const precioSchema = z
  .object({
    title_id: z.union([z.number(), z.string()]),
    sales_status: z.string(),
    regular_price: montoSchema.optional(),
    discount_price: montoSchema.optional(),
  })
  .passthrough();

export const respuestaPreciosSchema = z
  .object({
    personalized: z.boolean().optional(),
    country: z.string(),
    prices: z.array(precioSchema).default([]),
  })
  .passthrough();

export interface PrecioNintendo {
  nsuid: string;
  pais: string;
  estado: string;
  moneda: string;
  regular: Decimal;
  oferta: Decimal | null;
  ofertaDesde: Date | null;
  ofertaHasta: Date | null;
}

function fecha(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Normaliza la respuesta. Productos sin `regular_price` (no a la venta en ese
 * país: `not_found`, `unreleased` sin precio, etc.) se devuelven en `sinPrecio`.
 */
export function parsearPrecios(json: unknown): {
  precios: PrecioNintendo[];
  sinPrecio: { nsuid: string; estado: string }[];
} {
  const r = respuestaPreciosSchema.parse(json);
  const precios: PrecioNintendo[] = [];
  const sinPrecio: { nsuid: string; estado: string }[] = [];
  for (const p of r.prices) {
    const nsuid = String(p.title_id);
    const regular = p.regular_price ? parsearPrecio(p.regular_price.raw_value) : null;
    if (!p.regular_price || !regular) {
      sinPrecio.push({ nsuid, estado: p.sales_status });
      continue;
    }
    const oferta = p.discount_price ? parsearPrecio(p.discount_price.raw_value) : null;
    precios.push({
      nsuid,
      pais: r.country,
      estado: p.sales_status,
      moneda: p.regular_price.currency,
      regular,
      oferta: oferta && oferta.lt(regular) ? oferta : null,
      ofertaDesde: fecha(p.discount_price?.start_datetime),
      ofertaHasta: fecha(p.discount_price?.end_datetime),
    });
  }
  return { precios, sinPrecio };
}

export function urlPrecios(pais: string, idioma: string, nsuids: string[]): string {
  const u = new URL(fuentes.nintendoPrecios.baseUrl());
  u.searchParams.set("country", pais);
  u.searchParams.set("lang", idioma);
  u.searchParams.set("ids", nsuids.join(","));
  return u.toString();
}

export async function obtenerPrecios(pais: string, idioma: string, nsuids: string[]) {
  const max = fuentes.nintendoPrecios.maxIdsPorRequest();
  if (nsuids.length > max) throw new Error(`Máximo ${max} nsuids por pedido`);
  const json = await pedirJson(urlPrecios(pais, idioma, nsuids));
  return parsearPrecios(json);
}
