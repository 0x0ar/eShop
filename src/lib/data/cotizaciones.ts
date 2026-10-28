import type Decimal from "decimal.js";
import { MONEDAS_CRUZADAS, type MonedaPuente, type TipoCotizacion } from "@config/monedas";
import { db } from "@/lib/db";
import { dec } from "@/lib/domain/dinero";
import type { Cotizaciones } from "@/lib/domain/cotizaciones";

export const CLAVES_ARS = ["USD:oficial", "USD:blue", "EUR:oficial", "EUR:blue"] as const;

export interface CotizacionGuardada {
  clave: string;
  fuente: string;
  compra: string | null;
  venta: string;
  fechaFuente: string | null;
  registrado: string;
}

export interface CotizacionesVigentes {
  /** null si falta alguna cotización imprescindible (no se puede calcular nada en ARS). */
  cotizaciones: Cotizaciones | null;
  detalle: CotizacionGuardada[];
  faltantes: string[];
}

function aGuardada(r: {
  clave: string;
  fuente: string;
  compra: { toString(): string } | null;
  venta: { toString(): string };
  fechaFuente: Date | null;
  registrado: Date;
}): CotizacionGuardada {
  return {
    clave: r.clave,
    fuente: r.fuente,
    compra: r.compra?.toString() ?? null,
    venta: r.venta.toString(),
    fechaFuente: r.fechaFuente?.toISOString() ?? null,
    registrado: r.registrado.toISOString(),
  };
}

/** Última cotización guardada de cada clave (si una fuente falla, queda la anterior con su fecha). */
export async function cotizacionesVigentes(): Promise<CotizacionesVigentes> {
  const claves = [...CLAVES_ARS, ...MONEDAS_CRUZADAS.map((m) => `FX:${m}`)];
  const filas = await Promise.all(
    claves.map((clave) => db.cotizacion.findFirst({ where: { clave }, orderBy: { registrado: "desc" } })),
  );
  const detalle = filas.filter((f): f is NonNullable<typeof f> => f !== null).map(aGuardada);
  return { ...armarCotizaciones(detalle), detalle };
}

export function armarCotizaciones(detalle: CotizacionGuardada[]): Omit<CotizacionesVigentes, "detalle"> {
  const porClave = new Map(detalle.map((d) => [d.clave, d]));
  const faltantes = CLAVES_ARS.filter((c) => !porClave.has(c));
  const cruzadas: Record<string, Decimal> = {};
  for (const d of detalle) if (d.clave.startsWith("FX:")) cruzadas[d.clave.slice(3)] = dec(d.venta);
  if (faltantes.length > 0) return { cotizaciones: null, faltantes };
  const v = (c: string) => dec(porClave.get(c)!.venta);
  const ars = {} as Record<MonedaPuente, Record<TipoCotizacion, Decimal>>;
  ars.USD = { oficial: v("USD:oficial"), blue: v("USD:blue") };
  ars.EUR = { oficial: v("EUR:oficial"), blue: v("EUR:blue") };
  return { cotizaciones: { ars, cruzadas }, faltantes: [] };
}

/** Cotizaciones por día (última de cada día) para el historial. */
export async function cotizacionesPorDia(desdeDia: string): Promise<Map<string, Cotizaciones>> {
  const filas = await db.cotizacion.findMany({
    where: { dia: { gte: desdeDia } },
    orderBy: { registrado: "asc" },
  });
  const porDia = new Map<string, Map<string, CotizacionGuardada>>();
  for (const f of filas) {
    const m = porDia.get(f.dia) ?? new Map();
    m.set(f.clave, aGuardada(f));
    porDia.set(f.dia, m);
  }
  // Arrastra hacia adelante la última cotización conocida si un día falta alguna clave.
  const resultado = new Map<string, Cotizaciones>();
  const acumulado = new Map<string, CotizacionGuardada>();
  for (const dia of Array.from(porDia.keys()).sort()) {
    for (const [k, v] of porDia.get(dia)!) acumulado.set(k, v);
    const { cotizaciones } = armarCotizaciones(Array.from(acumulado.values()));
    if (cotizaciones) resultado.set(dia, cotizaciones);
  }
  return resultado;
}

const formatoDia = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Argentina/Buenos_Aires",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "YYYY-MM-DD" en hora de Buenos Aires. */
export function diaArgentina(fecha: Date = new Date()): string {
  return formatoDia.format(fecha);
}
