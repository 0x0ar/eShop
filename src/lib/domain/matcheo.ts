import { normalizarEditor, normalizarTitulo, similitud } from "./texto";

export type Plataforma = "SWITCH" | "SWITCH2" | "AMBAS";
export type TipoProducto =
  "JUEGO" | "DLC" | "PASE_EXPANSION" | "EDICION_ESPECIAL" | "SWITCH2_EDITION" | "UPGRADE" | "BUNDLE";

/** Producto tal como lo devuelve un catálogo regional, ya normalizado. */
export interface ProductoRegional {
  nsuid: string;
  titulo: string;
  editor: string | null;
  plataforma: Plataforma;
  tipo: TipoProducto;
  lanzamiento: Date | null;
}

export interface OverrideMatcheo {
  nsuidArgentina: string | null;
  nsuidEuropa: string | null;
}

export interface Par<A extends ProductoRegional = ProductoRegional, E extends ProductoRegional = ProductoRegional> {
  argentina: A;
  europa: E;
  puntaje: number;
  origen: "override" | "automatico";
}

export interface ResultadoMatcheo<A extends ProductoRegional, E extends ProductoRegional> {
  pares: Par<A, E>[];
  sinMatchArgentina: { producto: A; motivo: string }[];
  sinMatchEuropa: { producto: E; motivo: string }[];
}

export const UMBRAL_MATCH = 0.8;
export const MARGEN_AMBIGUEDAD = 0.04;
const MAX_DIAS_FECHA = 120;

function plataformasCompatibles(a: Plataforma, b: Plataforma): boolean {
  return a === b || a === "AMBAS" || b === "AMBAS";
}

/** Tipos que se consideran equivalentes entre catálogos (cada región los etiqueta distinto). */
function tiposCompatibles(a: TipoProducto, b: TipoProducto): boolean {
  if (a === b) return true;
  const grupo = (t: TipoProducto) =>
    t === "DLC" || t === "PASE_EXPANSION"
      ? "dlc"
      : t === "UPGRADE" || t === "SWITCH2_EDITION"
        ? "s2"
        : t === "JUEGO" || t === "EDICION_ESPECIAL" || t === "BUNDLE"
          ? "juego"
          : t;
  return grupo(a) === grupo(b);
}

/**
 * Puntaje entre 0 y 1 de que dos productos sean el mismo:
 * 65 % título, 20 % editor, 15 % fecha de lanzamiento.
 * Devuelve 0 si la plataforma o el tipo son incompatibles.
 */
export function puntajeMatch(a: ProductoRegional, b: ProductoRegional): number {
  if (!plataformasCompatibles(a.plataforma, b.plataforma)) return 0;
  if (!tiposCompatibles(a.tipo, b.tipo)) return 0;
  const ta = normalizarTitulo(a.titulo);
  const tb = normalizarTitulo(b.titulo);
  const sTitulo = similitud(ta, tb);
  if (sTitulo < 0.6) return 0;

  const ea = normalizarEditor(a.editor);
  const eb = normalizarEditor(b.editor);
  let sEditor = 0.5; // sin dato: neutro
  if (ea && eb) sEditor = ea === eb || ea.includes(eb) || eb.includes(ea) ? 1 : similitud(ea, eb);

  let sFecha = 0.5;
  if (a.lanzamiento && b.lanzamiento) {
    const dias = Math.abs(a.lanzamiento.getTime() - b.lanzamiento.getTime()) / 86_400_000;
    sFecha = dias <= 7 ? 1 : dias >= MAX_DIAS_FECHA ? 0 : 1 - dias / MAX_DIAS_FECHA;
  }
  return 0.65 * sTitulo + 0.2 * sEditor + 0.15 * sFecha;
}

/**
 * Matchea productos del catálogo de Argentina (EE. UU. comparte esos nsuid) con los del
 * catálogo europeo (ES y resto de Europa comparten nsuid).
 *
 * 1. Se aplican los overrides manuales (también sirven para marcar "no matchear").
 * 2. Para cada producto americano se busca el europeo con mayor puntaje.
 * 3. Se acepta si supera el umbral y le saca margen al segundo mejor; si dos
 *    americanos quieren el mismo europeo, gana el de mayor puntaje.
 */
export function matchearCatalogos<A extends ProductoRegional, E extends ProductoRegional>(
  argentina: A[],
  europa: E[],
  overrides: OverrideMatcheo[] = [],
): ResultadoMatcheo<A, E> {
  const porNsuidA = new Map(argentina.map((p) => [p.nsuid, p]));
  const porNsuidE = new Map(europa.map((p) => [p.nsuid, p]));
  const usadosA = new Set<string>();
  const usadosE = new Set<string>();
  const pares: Par<A, E>[] = [];
  const sinMatchArgentina: { producto: A; motivo: string }[] = [];
  const sinMatchEuropa: { producto: E; motivo: string }[] = [];

  for (const o of overrides) {
    if (o.nsuidArgentina) usadosA.add(o.nsuidArgentina);
    if (o.nsuidEuropa) usadosE.add(o.nsuidEuropa);
    const a = o.nsuidArgentina ? porNsuidA.get(o.nsuidArgentina) : undefined;
    const e = o.nsuidEuropa ? porNsuidE.get(o.nsuidEuropa) : undefined;
    if (a && e) pares.push({ argentina: a, europa: e, puntaje: 1, origen: "override" });
  }

  // Índice por primera palabra significativa del título para no comparar todo contra todo.
  const indice = new Map<string, E[]>();
  const claves = (t: string) => {
    const palabras = normalizarTitulo(t)
      .split(" ")
      .filter((p) => p.length > 2 && p !== "the");
    return palabras.slice(0, 2);
  };
  for (const e of europa) {
    if (usadosE.has(e.nsuid)) continue;
    for (const k of claves(e.titulo)) {
      const lista = indice.get(k) ?? [];
      lista.push(e);
      indice.set(k, lista);
    }
  }

  type Candidato = { a: A; e: E; puntaje: number };
  const mejores: Candidato[] = [];
  for (const a of argentina) {
    if (usadosA.has(a.nsuid)) continue;
    const vistos = new Set<string>();
    const puntajes: { e: E; puntaje: number }[] = [];
    for (const k of claves(a.titulo)) {
      for (const e of indice.get(k) ?? []) {
        if (vistos.has(e.nsuid)) continue;
        vistos.add(e.nsuid);
        const puntaje = puntajeMatch(a, e);
        if (puntaje > 0) puntajes.push({ e, puntaje });
      }
    }
    puntajes.sort((x, y) => y.puntaje - x.puntaje);
    const [primero, segundo] = puntajes;
    if (!primero || primero.puntaje < UMBRAL_MATCH) {
      sinMatchArgentina.push({
        producto: a,
        motivo: primero
          ? `Mejor candidato con puntaje bajo (${primero.puntaje.toFixed(2)}): ${primero.e.titulo}`
          : "Sin candidatos en Europa",
      });
      continue;
    }
    if (segundo && primero.puntaje - segundo.puntaje < MARGEN_AMBIGUEDAD) {
      sinMatchArgentina.push({ producto: a, motivo: `Ambiguo entre "${primero.e.titulo}" y "${segundo.e.titulo}"` });
      continue;
    }
    mejores.push({ a, e: primero.e, puntaje: primero.puntaje });
  }

  mejores.sort((x, y) => y.puntaje - x.puntaje);
  for (const m of mejores) {
    if (usadosE.has(m.e.nsuid)) {
      sinMatchArgentina.push({
        producto: m.a,
        motivo: `El candidato "${m.e.titulo}" ya está matcheado con otro producto`,
      });
      continue;
    }
    usadosE.add(m.e.nsuid);
    usadosA.add(m.a.nsuid);
    pares.push({ argentina: m.a, europa: m.e, puntaje: m.puntaje, origen: "automatico" });
  }

  for (const e of europa) {
    if (!usadosE.has(e.nsuid)) sinMatchEuropa.push({ producto: e, motivo: "Sin producto equivalente en Argentina" });
  }
  return { pares, sinMatchArgentina, sinMatchEuropa };
}
