import type { Plataforma, ProductoRegional, TipoProducto } from "@/lib/domain/matcheo";

/** Producto de catálogo normalizado, listo para guardar en ProductoRegional. */
export interface ProductoCatalogo extends ProductoRegional {
  imagenUrl: string | null;
  descripcion: string | null;
  popularidad: number;
  /** Enlace a la tienda por país. */
  urls: Record<string, string>;
}

/** Heurística común para detectar el tipo a partir del título. */
export function tipoDesdeTitulo(titulo: string, base: TipoProducto): TipoProducto {
  const t = titulo.toLowerCase();
  if (/nintendo switch 2 edition/.test(t)) {
    return /upgrade|mejora|actualizaci[oó]n/.test(t) ? "UPGRADE" : "SWITCH2_EDITION";
  }
  if (/upgrade pack|paquete de mejora/.test(t)) return "UPGRADE";
  if (base === "DLC") {
    return /expansion pass|pase de expansi[oó]n|season pass|pase de temporada/.test(t) ? "PASE_EXPANSION" : "DLC";
  }
  if (/bundle|pack|lote/.test(t) && base === "JUEGO") return "BUNDLE";
  if (
    /deluxe edition|complete edition|edici[oó]n (deluxe|completa|especial|definitiva)|gold edition|ultimate edition/.test(
      t,
    )
  ) {
    return "EDICION_ESPECIAL";
  }
  return base;
}

export function plataformaDesdeCodigos(codigos: string[]): Plataforma {
  const s1 = codigos.some((c) => /^(HAC|NINTENDO_SWITCH|nintendo switch)$/i.test(c));
  const s2 = codigos.some((c) => /^(BEE|NINTENDO_SWITCH_2|nintendo switch 2|switch2)$/i.test(c));
  if (s1 && s2) return "AMBAS";
  if (s2) return "SWITCH2";
  return "SWITCH";
}

export function fechaSegura(valor: unknown): Date | null {
  if (typeof valor !== "string" && typeof valor !== "number") return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) || d.getUTCFullYear() < 2000 || d.getUTCFullYear() > 2100 ? null : d;
}
