import { z } from "zod";
import type Decimal from "decimal.js";
import { fuentes } from "@config/fuentes";
import { MONEDAS_CRUZADAS } from "@config/monedas";
import { dec } from "@/lib/domain/dinero";
import { derivarEuroBlue } from "@/lib/domain/cotizaciones";
import { ErrorHttp, pedir, pedirJson } from "./http";

/**
 * DolarAPI (https://dolarapi.com): dólar y euro, oficial y blue.
 * Frankfurter (https://api.frankfurter.dev/v1): cruzadas con base EUR.
 */

export const cotizacionDolarApiSchema = z
  .object({
    moneda: z.string(),
    casa: z.string().optional(),
    nombre: z.string().optional(),
    compra: z.number().nullable(),
    venta: z.number(),
    fechaActualizacion: z.string(),
  })
  .passthrough();

export interface CotizacionObtenida {
  fuente: "dolarapi" | "frankfurter" | "derivado";
  clave: string;
  compra: Decimal | null;
  venta: Decimal;
  fechaFuente: Date | null;
}

export function parsearDolarApi(json: unknown, clave: string): CotizacionObtenida {
  const r = cotizacionDolarApiSchema.parse(json);
  return {
    fuente: "dolarapi",
    clave,
    compra: r.compra == null ? null : dec(r.compra),
    venta: dec(r.venta),
    fechaFuente: new Date(r.fechaActualizacion),
  };
}

export const frankfurterSchema = z
  .object({
    amount: z.number().optional(),
    base: z.string(),
    date: z.string(),
    rates: z.record(z.string(), z.number()),
  })
  .passthrough();

export function parsearFrankfurter(json: unknown): CotizacionObtenida[] {
  const r = frankfurterSchema.parse(json);
  if (r.base !== "EUR") throw new Error(`Frankfurter devolvió base ${r.base}, se esperaba EUR`);
  const fecha = new Date(`${r.date}T16:00:00Z`);
  return Object.entries(r.rates).map(([moneda, valor]) => ({
    fuente: "frankfurter" as const,
    clave: `FX:${moneda}`,
    compra: null,
    venta: dec(valor),
    fechaFuente: fecha,
  }));
}

export async function obtenerCruzadas(): Promise<CotizacionObtenida[]> {
  const u = new URL(`${fuentes.frankfurter.baseUrl()}/latest`);
  u.searchParams.set("from", "EUR");
  u.searchParams.set("to", MONEDAS_CRUZADAS.join(","));
  return parsearFrankfurter(await pedirJson(u.toString()));
}

/**
 * Obtiene dólar oficial/blue y euro oficial/blue. Si DolarAPI no tiene euro
 * blue en la ruta configurada (404), se deriva con dólar blue × USD/EUR.
 */
export async function obtenerCotizacionesArs(usdPorEur: () => Promise<Decimal>): Promise<CotizacionObtenida[]> {
  const base = fuentes.dolarApi.baseUrl();
  const r = fuentes.dolarApi.rutas;
  const [dOf, dBl, eOf] = await Promise.all([
    pedirJson(base + r.dolarOficial).then((j) => parsearDolarApi(j, "USD:oficial")),
    pedirJson(base + r.dolarBlue).then((j) => parsearDolarApi(j, "USD:blue")),
    pedirJson(base + r.euroOficial).then((j) => parsearDolarApi(j, "EUR:oficial")),
  ]);
  let eBl: CotizacionObtenida;
  try {
    const { estado, cuerpo } = await pedir(base + r.euroBlue(), { aceptar: [404] });
    if (estado === 404) throw new ErrorHttp(base + r.euroBlue(), 404);
    eBl = parsearDolarApi(JSON.parse(cuerpo), "EUR:blue");
  } catch (e) {
    if (!(e instanceof ErrorHttp) && !(e instanceof z.ZodError) && !(e instanceof SyntaxError)) throw e;
    const tasa = await usdPorEur();
    eBl = {
      fuente: "derivado",
      clave: "EUR:blue",
      compra: dBl.compra ? derivarEuroBlue(dBl.compra, tasa) : null,
      venta: derivarEuroBlue(dBl.venta, tasa),
      fechaFuente: dBl.fechaFuente,
    };
  }
  return [dOf, dBl, eOf, eBl];
}
