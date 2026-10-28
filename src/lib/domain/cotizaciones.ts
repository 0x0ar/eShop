import type Decimal from "decimal.js";
import { MONEDA_PUENTE, type MonedaPuente, type TipoCotizacion } from "@config/monedas";
import { D } from "./dinero";

/**
 * Cotizaciones vigentes para convertir a ARS.
 *
 * - `ars[USD|EUR][oficial|blue]`: pesos por unidad de la moneda puente (punta venta).
 * - `cruzadas[XXX]`: unidades de XXX por 1 EUR (formato de Frankfurter con base EUR).
 */
export interface Cotizaciones {
  ars: Record<MonedaPuente, Record<TipoCotizacion, Decimal>>;
  cruzadas: Record<string, Decimal>;
}

export class MonedaNoSoportadaError extends Error {
  constructor(public moneda: string) {
    super(`No hay forma de convertir ${moneda} a ARS (agregala a config/monedas.ts)`);
  }
}

function porEuro(moneda: string, c: Cotizaciones): Decimal {
  if (moneda === "EUR") return new D(1);
  const r = c.cruzadas[moneda];
  if (!r || r.lte(0)) throw new MonedaNoSoportadaError(moneda);
  return r;
}

/** Convierte un monto entre dos monedas distintas de ARS usando las cruzadas (base EUR). */
export function convertir(monto: Decimal, desde: string, hacia: string, c: Cotizaciones): Decimal {
  if (desde === hacia) return monto;
  const enEuros = monto.div(porEuro(desde, c));
  return enEuros.mul(porEuro(hacia, c));
}

export interface ConversionArs {
  ars: Decimal;
  monedaPuente: MonedaPuente | "ARS";
  montoPuente: Decimal;
  cotizacion: Decimal;
}

/**
 * `convertir(P) × C`: pasa el monto a la moneda puente (USD o EUR) y lo
 * multiplica por la cotización de DolarAPI elegida.
 */
export function aArs(monto: Decimal, moneda: string, tipo: TipoCotizacion, c: Cotizaciones): ConversionArs {
  if (moneda === "ARS") {
    return { ars: monto, monedaPuente: "ARS", montoPuente: monto, cotizacion: new D(1) };
  }
  const puente = MONEDA_PUENTE[moneda];
  if (!puente) throw new MonedaNoSoportadaError(moneda);
  const montoPuente = convertir(monto, moneda, puente, c);
  const cotizacion = c.ars[puente][tipo];
  return { ars: montoPuente.mul(cotizacion), monedaPuente: puente, montoPuente, cotizacion };
}

/**
 * Euro blue derivado: dólar blue × (USD por EUR). Se usa solo si DolarAPI no
 * publica el euro blue (ver docs/calculos.md).
 */
export function derivarEuroBlue(dolarBlue: Decimal, usdPorEur: Decimal): Decimal {
  return dolarBlue.mul(usdPorEur);
}
