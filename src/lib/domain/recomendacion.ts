import { TIPOS_COTIZACION, type TipoCotizacion } from "@config/monedas";
import { NOMBRE_REGION, nombrePais, paisesEuropa } from "@config/regiones";
import { REGIONES_GIFTCARD } from "@config/giftcards";
import { D } from "./dinero";
import type { CeldaDTO, OpcionDTO, PerfilUsuario, Requisito } from "./tipos";

/** ¿El usuario cumple este requisito? */
export function cumpleRequisito(r: Requisito, perfil: PerfilUsuario): boolean {
  switch (r.tipo) {
    case "cuenta":
      return perfil.cuentas == null || r.paises.some((p) => perfil.cuentas!.includes(p));
    case "tarjeta_ar":
      return perfil.tarjetaArgentina;
    case "tarjeta_exterior":
    case "pago_mixto":
      return perfil.tarjetaExterior;
    case "gift_card":
      return perfil.giftCards;
    case "key_region":
      return perfil.keys;
    case "marketplace":
      return perfil.marketplaces;
  }
}

export function celdaViable(celda: CeldaDTO, perfil: PerfilUsuario): boolean {
  return celda.requisitos.every((r) => cumpleRequisito(r, perfil));
}

/** La celda más barata que el usuario puede usar para una opción y cotización. */
export function mejorCeldaViable(op: OpcionDTO, tipo: TipoCotizacion, perfil: PerfilUsuario): CeldaDTO | null {
  return op.candidatos[tipo].find((c) => celdaViable(c, perfil)) ?? null;
}

export interface Recomendacion {
  mejor: CeldaDTO | null;
  mejorPorTipo: Record<TipoCotizacion, CeldaDTO | null>;
  /** eShop Argentina + tarjeta argentina, con la misma cotización que `mejor`. */
  referencia: CeldaDTO | null;
  referenciaPorTipo: Record<TipoCotizacion, CeldaDTO | null>;
  ahorroArs: string | null;
  ahorroPorcentaje: string | null;
}

function masBarata(celdas: (CeldaDTO | null)[]): CeldaDTO | null {
  let mejor: CeldaDTO | null = null;
  for (const c of celdas) {
    if (!c) continue;
    if (!mejor || new D(c.ars).lt(new D(mejor.ars))) mejor = c;
  }
  return mejor;
}

/**
 * Elige la opción más barata (región + método + cotización) entre las que el
 * perfil del usuario puede usar, y calcula el ahorro frente a comprar en la
 * eShop argentina con tarjeta argentina usando la misma cotización.
 */
export function recomendar(
  opciones: OpcionDTO[],
  perfil: PerfilUsuario,
  tipos: readonly TipoCotizacion[] = TIPOS_COTIZACION,
): Recomendacion {
  const referenciaOp = opciones.find((o) => o.region === "AR" && o.metodo === "tarjeta_ar");
  const mejorPorTipo = { oficial: null, blue: null } as Record<TipoCotizacion, CeldaDTO | null>;
  const referenciaPorTipo = { oficial: null, blue: null } as Record<TipoCotizacion, CeldaDTO | null>;
  for (const tipo of tipos) {
    mejorPorTipo[tipo] = masBarata(opciones.map((o) => mejorCeldaViable(o, tipo, perfil)));
    referenciaPorTipo[tipo] = referenciaOp?.candidatos[tipo][0] ?? null;
  }
  const mejor = masBarata(tipos.map((t) => mejorPorTipo[t]));
  const referencia = mejor ? referenciaPorTipo[mejor.tipo] : null;
  let ahorroArs: string | null = null;
  let ahorroPorcentaje: string | null = null;
  if (mejor && referencia) {
    const ahorro = new D(referencia.ars).sub(new D(mejor.ars));
    ahorroArs = ahorro.toFixed();
    const ref = new D(referencia.ars);
    ahorroPorcentaje = ref.gt(0) ? ahorro.div(ref).mul(100).toFixed() : null;
  }
  return { mejor, mejorPorTipo, referencia, referenciaPorTipo, ahorroArs, ahorroPorcentaje };
}

function nombreRegionCuenta(paises: string[]): string {
  if (paises.length === 1) return nombrePais(paises[0]);
  const eu = paisesEuropa();
  if (paises.every((p) => eu.includes(p) || p === "ES")) return "un país europeo (" + paises.join(", ") + ")";
  return paises.map(nombrePais).join(", ");
}

const NOMBRE_REGION_KEY: Record<string, string> = {
  EU: "Europa",
  US: "Estados Unidos",
  LATAM: "Latinoamérica",
  GLOBAL: "cualquier región",
};

/** Texto en español para mostrar un requisito. */
export function textoRequisito(r: Requisito): string {
  switch (r.tipo) {
    case "cuenta":
      return `Requiere cuenta de Nintendo de ${nombreRegionCuenta(r.paises)}`;
    case "tarjeta_ar":
      return r.pais === "AR"
        ? "Tarjeta de crédito o débito emitida en Argentina (se suma IVA)"
        : `Pagás con tarjeta argentina en la eShop de ${nombrePais(r.pais)}: muchas eShops la rechazan`;
    case "tarjeta_exterior":
      return r.pais === "AR"
        ? "Requiere tarjeta emitida fuera de Argentina que la eShop argentina acepte"
        : `Requiere tarjeta emitida en ${nombrePais(r.pais)}`;
    case "gift_card":
      return `Gift cards de la región ${REGIONES_GIFTCARD[r.region]?.nombre ?? r.region}`;
    case "key_region":
      return r.region === "GLOBAL"
        ? "Key sin restricción de región"
        : `La key se activa solo en cuentas de ${NOMBRE_REGION_KEY[r.region] ?? r.region}`;
    case "marketplace":
      return `Vendedor de marketplace de terceros (${r.tiendas.join(", ")})`;
    case "pago_mixto":
      return `Pagás la diferencia con tarjeta emitida en ${nombrePais(r.pais)}`;
  }
}

export { NOMBRE_REGION };
