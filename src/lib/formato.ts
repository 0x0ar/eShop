import Decimal from "decimal.js";

/**
 * Formatos es-AR. Este es el único lugar donde un monto se redondea: los
 * cálculos trabajan con decimales exactos y recién acá se pasan a 2 decimales.
 */

const ZONA = "America/Argentina/Buenos_Aires";

const formatosMoneda = new Map<string, Intl.NumberFormat>();

function formatoMoneda(moneda: string, decimales: number): Intl.NumberFormat {
  const clave = `${moneda}:${decimales}`;
  let f = formatosMoneda.get(clave);
  if (!f) {
    f = new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: moneda,
      currencyDisplay: moneda === "ARS" ? "symbol" : "code",
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    });
    formatosMoneda.set(clave, f);
  }
  return f;
}

function redondear(valor: Decimal.Value, decimales: number): string {
  return new Decimal(valor).toDecimalPlaces(decimales, Decimal.ROUND_HALF_UP).toFixed(decimales);
}

/** "$ 1.234,56" (espacio duro reemplazado por espacio común para que sea predecible). */
export function formatearArs(valor: Decimal.Value | null | undefined, decimales = 2): string {
  if (valor == null) return "—";
  // Intl acepta strings numéricos exactos; así no se pierde precisión.
  return formatoMoneda("ARS", decimales)
    .format(redondear(valor, decimales) as unknown as number)
    .replace(/ /g, " ");
}

/** "USD 59,99", "EUR 69,99". */
export function formatearMoneda(valor: Decimal.Value | null | undefined, moneda: string, decimales = 2): string {
  if (valor == null) return "—";
  if (moneda === "ARS") return formatearArs(valor, decimales);
  return formatoMoneda(moneda, decimales)
    .format(redondear(valor, decimales) as unknown as number)
    .replace(/ /g, " ");
}

export function formatearNumero(valor: Decimal.Value, decimales = 2): string {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(redondear(valor, decimales) as unknown as number);
}

export function formatearPorcentaje(valor: Decimal.Value, decimales = 0): string {
  return `${formatearNumero(valor, decimales)} %`;
}

const fechaHora = new Intl.DateTimeFormat("es-AR", {
  timeZone: ZONA,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const fecha = new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, day: "2-digit", month: "2-digit", year: "numeric" });
const fechaCorta = new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, day: "2-digit", month: "short" });

function aDate(v: Date | string | number): Date {
  return v instanceof Date ? v : new Date(v);
}

export function formatearFechaHora(v: Date | string | number | null | undefined): string {
  return v == null ? "—" : fechaHora.format(aDate(v)).replace(",", "");
}

export function formatearFecha(v: Date | string | number | null | undefined): string {
  return v == null ? "—" : fecha.format(aDate(v));
}

export function formatearFechaCorta(v: Date | string | number): string {
  return fechaCorta.format(aDate(v));
}

/** "hace 5 min", "hace 3 h", "hace 2 días". `ahora` se pasa para que sea testeable. */
export function haceCuanto(v: Date | string | number, ahora: Date = new Date()): string {
  const seg = Math.max(0, Math.round((ahora.getTime() - aDate(v).getTime()) / 1000));
  if (seg < 60) return "hace instantes";
  const min = Math.round(seg / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} días`;
}
