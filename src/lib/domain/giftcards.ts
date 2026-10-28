import type Decimal from "decimal.js";
import { D } from "./dinero";

/** Una gift card que se puede comprar, con su costo ya expresado en ARS. */
export interface TarjetaDisponible<T = unknown> {
  id: string;
  /** Valor nominal en centavos de la moneda de la eShop. */
  valorCentavos: number;
  costoArs: Decimal;
  datos: T;
}

export interface LineaCompra<T = unknown> {
  tarjeta: TarjetaDisponible<T>;
  cantidad: number;
}

export interface CombinacionGiftCards<T = unknown> {
  lineas: LineaCompra<T>[];
  costoTarjetasArs: Decimal;
  /** Costo de pagar con tarjeta la parte no cubierta (solo con pago mixto). */
  costoRestanteArs: Decimal;
  costoTotalArs: Decimal;
  valorTotalCentavos: number;
  /** Saldo que queda en la cuenta después de comprar el juego. */
  sobranteCentavos: number;
  /** Parte del precio pagada con tarjeta (solo con pago mixto). */
  restanteCentavos: number;
  cantidadTarjetas: number;
}

export interface OpcionesOptimizador {
  /**
   * Si la eShop permite saldo + tarjeta, costo en ARS de pagar 1 centavo de la
   * moneda de la eShop con tarjeta. `null` = las gift cards tienen que cubrir todo.
   */
  costoPorCentavoRestante?: Decimal | null;
  /** Tope de estados del DP para no colgar el proceso con precios absurdos. */
  maxEstados?: number;
}

function mcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

/**
 * Encuentra la combinación de gift cards (con repetición) que cubre
 * `precioCentavos` al menor costo total en ARS.
 *
 * Es un problema de "cobertura de costo mínimo" (unbounded knapsack): se
 * calcula con programación dinámica el costo mínimo para juntar exactamente
 * cada valor nominal posible y después se elige el mejor valor ≥ precio.
 * Desempates: menos saldo sobrante, después menos tarjetas.
 */
export function optimizarGiftCards<T>(
  precioCentavos: number,
  tarjetas: TarjetaDisponible<T>[],
  opciones: OpcionesOptimizador = {},
): CombinacionGiftCards<T> | null {
  if (!Number.isInteger(precioCentavos) || precioCentavos < 0) {
    throw new Error(`Precio inválido: ${precioCentavos}`);
  }
  const validas = tarjetas.filter((t) => Number.isInteger(t.valorCentavos) && t.valorCentavos > 0 && t.costoArs.gte(0));
  const costoRestante = opciones.costoPorCentavoRestante ?? null;

  if (precioCentavos === 0) {
    return armar([], 0, 0, costoRestante);
  }
  if (validas.length === 0) {
    return costoRestante ? armar([], 0, precioCentavos, costoRestante) : null;
  }

  // Si dos tarjetas tienen el mismo valor, solo importa la más barata.
  const porValor = new Map<number, TarjetaDisponible<T>>();
  for (const t of validas) {
    const actual = porValor.get(t.valorCentavos);
    if (!actual || t.costoArs.lt(actual.costoArs)) porValor.set(t.valorCentavos, t);
  }
  const unicas = Array.from(porValor.values());

  // Se trabaja en múltiplos del MCD de los valores para achicar el DP.
  const paso = unicas.reduce((g, t) => mcd(g, t.valorCentavos), 0);
  const maxValor = Math.max(...unicas.map((t) => t.valorCentavos));
  const objetivo = Math.ceil(precioCentavos / paso);
  const limite = objetivo + Math.ceil(maxValor / paso) - 1;
  const maxEstados = opciones.maxEstados ?? 2_000_000;
  if (limite > maxEstados) {
    throw new Error(`Demasiados estados para optimizar gift cards (${limite})`);
  }

  const unidades = unicas.map((t) => t.valorCentavos / paso);
  const costo: (Decimal | null)[] = new Array(limite + 1).fill(null);
  const cantidad: number[] = new Array(limite + 1).fill(0);
  const ultima: number[] = new Array(limite + 1).fill(-1);
  costo[0] = new D(0);

  for (let s = 1; s <= limite; s++) {
    for (let i = 0; i < unicas.length; i++) {
      const prev = s - unidades[i];
      if (prev < 0) continue;
      const base = costo[prev];
      if (base == null) continue;
      const candidato = base.add(unicas[i].costoArs);
      const cant = cantidad[prev] + 1;
      const actual = costo[s];
      if (actual == null || candidato.lt(actual) || (candidato.eq(actual) && cant < cantidad[s])) {
        costo[s] = candidato;
        cantidad[s] = cant;
        ultima[s] = i;
      }
    }
  }

  let mejor: CombinacionGiftCards<T> | null = null;
  const considerar = (s: number) => {
    if (costo[s] == null) return;
    const valor = s * paso;
    const restante = Math.max(0, precioCentavos - valor);
    if (restante > 0 && !costoRestante) return;
    const combo = armar(reconstruir(s, ultima, unidades, unicas), valor, restante, costoRestante, precioCentavos);
    if (mejor == null || esMejor(combo, mejor)) mejor = combo;
  };
  for (let s = objetivo; s <= limite; s++) considerar(s);
  if (costoRestante) for (let s = 0; s < objetivo; s++) considerar(s);
  return mejor;
}

function esMejor<T>(a: CombinacionGiftCards<T>, b: CombinacionGiftCards<T>): boolean {
  const c = a.costoTotalArs.cmp(b.costoTotalArs);
  if (c !== 0) return c < 0;
  if (a.sobranteCentavos !== b.sobranteCentavos) return a.sobranteCentavos < b.sobranteCentavos;
  return a.cantidadTarjetas < b.cantidadTarjetas;
}

function reconstruir<T>(
  s: number,
  ultima: number[],
  unidades: number[],
  unicas: TarjetaDisponible<T>[],
): LineaCompra<T>[] {
  const cuenta = new Map<number, number>();
  while (s > 0) {
    const i = ultima[s];
    cuenta.set(i, (cuenta.get(i) ?? 0) + 1);
    s -= unidades[i];
  }
  return Array.from(cuenta.entries())
    .map(([i, c]) => ({ tarjeta: unicas[i], cantidad: c }))
    .sort((a, b) => b.tarjeta.valorCentavos - a.tarjeta.valorCentavos);
}

function armar<T>(
  lineas: LineaCompra<T>[],
  valorTotalCentavos: number,
  restanteCentavos: number,
  costoRestante: Decimal | null,
  precioCentavos = valorTotalCentavos + restanteCentavos,
): CombinacionGiftCards<T> {
  const costoTarjetasArs = lineas.reduce((acc, l) => acc.add(l.tarjeta.costoArs.mul(l.cantidad)), new D(0));
  const costoRestanteArs = restanteCentavos > 0 && costoRestante ? costoRestante.mul(restanteCentavos) : new D(0);
  return {
    lineas,
    costoTarjetasArs,
    costoRestanteArs,
    costoTotalArs: costoTarjetasArs.add(costoRestanteArs),
    valorTotalCentavos,
    sobranteCentavos: Math.max(0, valorTotalCentavos - precioCentavos),
    restanteCentavos,
    cantidadTarjetas: lineas.reduce((acc, l) => acc + l.cantidad, 0),
  };
}
