import Decimal from "decimal.js";

/**
 * Toda la plata se maneja con decimal.js. Nunca usar `number` para montos:
 * el redondeo se hace solo al mostrar (ver src/lib/formato.ts).
 */
export const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export type Dec = Decimal;

export type ValorDecimal = Decimal | string | number;

export function dec(valor: ValorDecimal | { toString(): string }): Decimal {
  if (valor instanceof Decimal) return valor;
  if (typeof valor === "number") {
    if (!Number.isFinite(valor)) throw new Error(`Monto inválido: ${valor}`);
    // Pasar por string evita arrastrar el error binario del float.
    return new D(String(valor));
  }
  return new D(valor.toString());
}

/** Monto en centavos (entero) → Decimal en unidades. */
export function desdeCentavos(centavos: number | bigint): Decimal {
  return new D(centavos.toString()).div(100);
}

/** Decimal en unidades → centavos enteros (redondeo half-up). */
export function aCentavos(monto: Decimal): number {
  return monto.mul(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

export function sumar(montos: Decimal[]): Decimal {
  return montos.reduce((acc, m) => acc.add(m), new D(0));
}

export function minimo<T>(items: T[], valor: (t: T) => Decimal | null | undefined): T | null {
  let mejor: T | null = null;
  let mejorValor: Decimal | null = null;
  for (const item of items) {
    const v = valor(item);
    if (v == null) continue;
    if (mejorValor == null || v.lt(mejorValor)) {
      mejor = item;
      mejorValor = v;
    }
  }
  return mejor;
}

/**
 * Parsea un precio que viene como string ("59.99", "1.234,56", "$59.99").
 * Acepta punto o coma decimal; si hay ambos, el último es el separador decimal.
 */
export function parsearPrecio(texto: string): Decimal | null {
  const limpio = texto.replace(/[^\d.,-]/g, "");
  if (!limpio || !/\d/.test(limpio)) return null;
  const ultimoPunto = limpio.lastIndexOf(".");
  const ultimaComa = limpio.lastIndexOf(",");
  let normalizado: string;
  if (ultimoPunto >= 0 && ultimaComa >= 0) {
    const sepDecimal = ultimoPunto > ultimaComa ? "." : ",";
    const sepMiles = sepDecimal === "." ? "," : ".";
    normalizado = limpio.split(sepMiles).join("").replace(sepDecimal, ".");
  } else if (ultimaComa >= 0 || ultimoPunto >= 0) {
    // Un solo separador: es decimal salvo que aparezca varias veces o tenga
    // exactamente 3 dígitos detrás ("1.234" / "1,234" → miles).
    const sep = ultimaComa >= 0 ? "," : ".";
    const partes = limpio.split(sep);
    normalizado = partes.length === 2 && partes[1].length !== 3 ? partes.join(".") : partes.join("");
  } else {
    normalizado = limpio;
  }
  try {
    const d = new D(normalizado);
    return d.isFinite() ? d : null;
  } catch {
    return null;
  }
}
