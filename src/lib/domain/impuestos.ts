import type Decimal from "decimal.js";
import { IMPUESTOS, type Impuesto, type MetodoPago } from "@config/impuestos";
import { D } from "./dinero";

export interface DetalleImpuesto {
  id: string;
  nombre: string;
  tasa: Decimal;
  monto: Decimal;
}

export interface ConImpuestos {
  total: Decimal;
  impuestos: DetalleImpuesto[];
}

export function impuestosPara(metodo: MetodoPago, lista: Impuesto[] = IMPUESTOS): Impuesto[] {
  return lista.filter((i) => i.aplicaA.includes(metodo));
}

/** `ARS × (1 + Σ tasas)`: los impuestos se calculan todos sobre la base, no en cascada. */
export function aplicarImpuestos(base: Decimal, metodo: MetodoPago, lista: Impuesto[] = IMPUESTOS): ConImpuestos {
  const impuestos = impuestosPara(metodo, lista).map((i) => {
    const tasa = new D(i.tasa);
    return { id: i.id, nombre: i.nombre, tasa, monto: base.mul(tasa) };
  });
  const total = impuestos.reduce((acc, i) => acc.add(i.monto), base);
  return { total, impuestos };
}
