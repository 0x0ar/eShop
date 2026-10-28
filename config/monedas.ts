/**
 * Cómo se pasa cada moneda a pesos.
 *
 * Toda conversión a ARS usa una cotización de DolarAPI (dólar o euro, oficial o
 * blue). Las monedas que no son USD ni EUR primero se convierten a su "moneda
 * puente" con Frankfurter y después se multiplica por la cotización en ARS.
 */

export type MonedaPuente = "USD" | "EUR";

export const MONEDA_PUENTE: Record<string, MonedaPuente> = {
  USD: "USD",
  EUR: "EUR",
  GBP: "EUR",
  PLN: "EUR",
  CHF: "EUR",
  SEK: "EUR",
  NOK: "EUR",
  DKK: "EUR",
  CZK: "EUR",
  CAD: "USD",
  MXN: "USD",
  BRL: "USD",
};

/** Monedas que se le piden a Frankfurter (siempre con base EUR). */
export const MONEDAS_CRUZADAS = ["USD", "GBP", "PLN", "CHF", "CAD", "MXN", "BRL"];

/**
 * Qué punta de la cotización se usa. Quien compra afuera paga con dólares/euros
 * que tiene que comprar, así que se usa el precio de venta.
 */
export const PUNTA_COTIZACION: "compra" | "venta" = "venta";

export const TIPOS_COTIZACION = ["oficial", "blue"] as const;
export type TipoCotizacion = (typeof TIPOS_COTIZACION)[number];
