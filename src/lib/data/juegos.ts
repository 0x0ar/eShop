import Fuse from "fuse.js";
import { db } from "@/lib/db";
import { dec } from "@/lib/domain/dinero";
import { normalizarTexto } from "@/lib/domain/texto";

export interface JuegoResumen {
  id: string;
  slug: string;
  titulo: string;
  editor: string | null;
  imagenUrl: string | null;
  plataforma: string;
  tipo: string;
  lanzamiento: string | null;
  enOferta: boolean;
  descuentoMax: number;
  mejorArsOficial: string | null;
  mejorArsBlue: string | null;
  referenciaArsOficial: string | null;
  resumenActualizado: string | null;
  popularidad: number;
}

const SELECT_RESUMEN = {
  id: true,
  slug: true,
  titulo: true,
  tituloNormalizado: true,
  editor: true,
  imagenUrl: true,
  plataforma: true,
  tipo: true,
  lanzamiento: true,
  enOferta: true,
  descuentoMax: true,
  mejorArsOficial: true,
  mejorArsBlue: true,
  referenciaArsOficial: true,
  resumenActualizado: true,
  popularidad: true,
} as const;

type FilaResumen = Awaited<ReturnType<typeof filasResumen>>[number];

function filasResumen(where: Parameters<typeof db.juego.findMany>[0] = {}) {
  return db.juego.findMany({ ...where, select: SELECT_RESUMEN });
}

export function aResumen(j: FilaResumen): JuegoResumen {
  return {
    id: j.id,
    slug: j.slug,
    titulo: j.titulo,
    editor: j.editor,
    imagenUrl: j.imagenUrl,
    plataforma: j.plataforma,
    tipo: j.tipo,
    lanzamiento: j.lanzamiento?.toISOString() ?? null,
    enOferta: j.enOferta,
    descuentoMax: j.descuentoMax,
    mejorArsOficial: j.mejorArsOficial?.toString() ?? null,
    mejorArsBlue: j.mejorArsBlue?.toString() ?? null,
    referenciaArsOficial: j.referenciaArsOficial?.toString() ?? null,
    resumenActualizado: j.resumenActualizado?.toISOString() ?? null,
    popularidad: j.popularidad,
  };
}

export async function ofertasDestacadas(cantidad = 12): Promise<JuegoResumen[]> {
  const filas = await filasResumen({
    where: { enOferta: true, mejorArsOficial: { not: null } },
    orderBy: [{ popularidad: "desc" }, { descuentoMax: "desc" }],
    take: cantidad,
  });
  return filas.map(aResumen);
}

export async function juegosPopulares(cantidad = 12): Promise<JuegoResumen[]> {
  const filas = await filasResumen({
    where: { tipo: { in: ["JUEGO", "SWITCH2_EDITION", "EDICION_ESPECIAL"] } },
    orderBy: [{ popularidad: "desc" }, { titulo: "asc" }],
    take: cantidad,
  });
  return filas.map(aResumen);
}

export async function juegosPorSlugs(slugs: string[]): Promise<JuegoResumen[]> {
  if (slugs.length === 0) return [];
  const filas = await filasResumen({ where: { slug: { in: slugs.slice(0, 200) } } });
  const orden = new Map(slugs.map((s, i) => [s, i]));
  return filas.map(aResumen).sort((a, b) => (orden.get(a.slug) ?? 0) - (orden.get(b.slug) ?? 0));
}

// ─── Búsqueda ──────────────────────────────────────────────────────────

interface Indice {
  fuse: Fuse<FilaResumen & { busqueda: string }>;
  filas: (FilaResumen & { busqueda: string })[];
  creado: number;
}

let indice: Indice | null = null;
let construyendo: Promise<Indice> | null = null;
const TTL_INDICE_MS = 10 * 60 * 1000;

async function construirIndice(): Promise<Indice> {
  const filas = (await filasResumen()).map((f) => ({
    ...f,
    busqueda: `${f.tituloNormalizado} ${normalizarTexto(f.titulo)} ${normalizarTexto(f.editor ?? "")}`,
  }));
  const fuse = new Fuse(filas, {
    keys: [
      { name: "busqueda", weight: 0.85 },
      { name: "editor", weight: 0.15 },
    ],
    threshold: 0.35,
    ignoreLocation: true,
    ignoreDiacritics: true,
    includeScore: true,
    minMatchCharLength: 2,
  });
  return { fuse, filas, creado: Date.now() };
}

/** Índice en memoria, refrescado cada 10 minutos (ver docs/decisiones.md). */
async function obtenerIndice(): Promise<Indice> {
  if (indice && Date.now() - indice.creado < TTL_INDICE_MS) return indice;
  if (!construyendo) {
    construyendo = construirIndice().finally(() => {
      construyendo = null;
    });
  }
  indice = await construyendo;
  return indice;
}

export function invalidarIndiceBusqueda() {
  indice = null;
}

export const ORDENES = {
  relevancia: "Relevancia",
  precio: "Menor precio",
  descuento: "Mayor descuento",
  lanzamiento: "Más nuevos",
  popularidad: "Más populares",
} as const;
export type Orden = keyof typeof ORDENES;

export interface FiltrosBusqueda {
  q?: string;
  plataforma?: string;
  tipo?: string;
  oferta?: boolean;
  /** Rango sobre el mejor precio en ARS (cotización oficial). */
  min?: string;
  max?: string;
  orden?: Orden;
  pagina?: number;
}

export const POR_PAGINA = 24;

export async function buscarJuegos(
  f: FiltrosBusqueda,
): Promise<{ resultados: JuegoResumen[]; total: number; pagina: number; paginas: number }> {
  const { fuse, filas } = await obtenerIndice();
  const q = normalizarTexto(f.q ?? "");
  let lista: (FilaResumen & { busqueda: string })[] = q
    ? fuse.search(q, { limit: 2000 }).map((r) => r.item)
    : [...filas];

  const min = f.min ? dec(f.min) : null;
  const max = f.max ? dec(f.max) : null;
  lista = lista.filter((j) => {
    if (f.plataforma && j.plataforma !== f.plataforma && j.plataforma !== "AMBAS") return false;
    if (f.tipo && j.tipo !== f.tipo) return false;
    if (f.oferta && !j.enOferta) return false;
    if (min || max) {
      if (!j.mejorArsOficial) return false;
      const p = dec(j.mejorArsOficial.toString());
      if (min && p.lt(min)) return false;
      if (max && p.gt(max)) return false;
    }
    return true;
  });

  const orden = f.orden ?? (q ? "relevancia" : "popularidad");
  const valor = (j: FilaResumen) => (j.mejorArsOficial ? dec(j.mejorArsOficial.toString()) : null);
  if (orden === "precio") {
    lista.sort((a, b) => {
      const va = valor(a);
      const vb = valor(b);
      if (!va) return vb ? 1 : 0;
      if (!vb) return -1;
      return va.cmp(vb);
    });
  } else if (orden === "descuento") {
    lista.sort((a, b) => b.descuentoMax - a.descuentoMax || b.popularidad - a.popularidad);
  } else if (orden === "lanzamiento") {
    lista.sort((a, b) => (b.lanzamiento?.getTime() ?? 0) - (a.lanzamiento?.getTime() ?? 0));
  } else if (orden === "popularidad") {
    lista.sort((a, b) => b.popularidad - a.popularidad || a.titulo.localeCompare(b.titulo, "es"));
  }

  const total = lista.length;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const pagina = Math.min(Math.max(1, f.pagina ?? 1), paginas);
  const resultados = lista.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA).map(aResumen);
  return { resultados, total, pagina, paginas };
}

export async function hayDatosDemo(): Promise<boolean> {
  return (await db.juego.count({ where: { origen: "demo" } })) > 0;
}
