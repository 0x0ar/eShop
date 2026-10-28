/**
 * Regiones y eShops que compara el sitio.
 *
 * - Las "regiones de comparación" son las cuatro columnas que ve el usuario:
 *   Argentina, España, Europa (mejor precio entre varias eShops) y Estados Unidos.
 * - Cada región se resuelve contra una o más eShops de país (`PaisTienda`).
 * - La lista de países de "Europa" se puede cambiar acá o con la variable
 *   de entorno `EUROPA_PAISES` (por ejemplo `DE,FR,IT,PT,NL,PL,GB`).
 */

export const REGIONES_COMPARACION = ["AR", "ES", "EU", "US"] as const;
export type RegionComparacion = (typeof REGIONES_COMPARACION)[number];

/** Catálogo al que pertenece una eShop. El nsuid es compartido dentro de cada catálogo. */
export type CatalogoRegional = "ARGENTINA" | "EUROPA";

export interface PaisTienda {
  codigo: string;
  nombre: string;
  /** Idioma que se manda a la API de precios. */
  idiomaPrecios: string;
  catalogo: CatalogoRegional;
  /** Locale de nintendo.com para armar enlaces a la tienda. */
  localeSitio: string;
  /** Núcleo de idioma del buscador de Nintendo Europa (solo catálogo EUROPA). */
  nucleoBusquedaEuropa?: string;
}

export const PAISES: Record<string, PaisTienda> = {
  AR: { codigo: "AR", nombre: "Argentina", idiomaPrecios: "es", catalogo: "ARGENTINA", localeSitio: "es-ar" },
  US: { codigo: "US", nombre: "Estados Unidos", idiomaPrecios: "en", catalogo: "ARGENTINA", localeSitio: "us" },
  ES: {
    codigo: "ES",
    nombre: "España",
    idiomaPrecios: "es",
    catalogo: "EUROPA",
    localeSitio: "es-es",
    nucleoBusquedaEuropa: "es",
  },
  DE: {
    codigo: "DE",
    nombre: "Alemania",
    idiomaPrecios: "de",
    catalogo: "EUROPA",
    localeSitio: "de-de",
    nucleoBusquedaEuropa: "de",
  },
  FR: {
    codigo: "FR",
    nombre: "Francia",
    idiomaPrecios: "fr",
    catalogo: "EUROPA",
    localeSitio: "fr-fr",
    nucleoBusquedaEuropa: "fr",
  },
  IT: {
    codigo: "IT",
    nombre: "Italia",
    idiomaPrecios: "it",
    catalogo: "EUROPA",
    localeSitio: "it-it",
    nucleoBusquedaEuropa: "it",
  },
  PT: {
    codigo: "PT",
    nombre: "Portugal",
    idiomaPrecios: "pt",
    catalogo: "EUROPA",
    localeSitio: "pt-pt",
    nucleoBusquedaEuropa: "pt",
  },
  NL: {
    codigo: "NL",
    nombre: "Países Bajos",
    idiomaPrecios: "nl",
    catalogo: "EUROPA",
    localeSitio: "nl-nl",
    nucleoBusquedaEuropa: "nl",
  },
  PL: {
    codigo: "PL",
    nombre: "Polonia",
    idiomaPrecios: "en",
    catalogo: "EUROPA",
    localeSitio: "pl-pl",
    nucleoBusquedaEuropa: "en",
  },
  GB: {
    codigo: "GB",
    nombre: "Reino Unido",
    idiomaPrecios: "en",
    catalogo: "EUROPA",
    localeSitio: "en-gb",
    nucleoBusquedaEuropa: "en",
  },
  BE: {
    codigo: "BE",
    nombre: "Bélgica",
    idiomaPrecios: "fr",
    catalogo: "EUROPA",
    localeSitio: "fr-be",
    nucleoBusquedaEuropa: "fr",
  },
  AT: {
    codigo: "AT",
    nombre: "Austria",
    idiomaPrecios: "de",
    catalogo: "EUROPA",
    localeSitio: "de-at",
    nucleoBusquedaEuropa: "de",
  },
  IE: {
    codigo: "IE",
    nombre: "Irlanda",
    idiomaPrecios: "en",
    catalogo: "EUROPA",
    localeSitio: "en-ie",
    nucleoBusquedaEuropa: "en",
  },
};

/** Países por defecto para la región "Europa" (España tiene su propia columna). */
export const EUROPA_PAISES_DEFAULT = ["DE", "FR", "IT", "PT", "NL", "PL", "GB"];

function parsearListaPaises(valor: string | undefined): string[] | null {
  if (!valor) return null;
  const lista = valor
    .split(",")
    .map((p) => p.trim().toUpperCase())
    .filter(Boolean);
  const desconocidos = lista.filter((p) => !PAISES[p] || PAISES[p].catalogo !== "EUROPA");
  if (desconocidos.length > 0) {
    throw new Error(
      `EUROPA_PAISES tiene países no soportados: ${desconocidos.join(", ")}. ` +
        `Agregalos a PAISES en config/regiones.ts.`,
    );
  }
  return lista;
}

export function paisesEuropa(): string[] {
  return parsearListaPaises(process.env.EUROPA_PAISES) ?? EUROPA_PAISES_DEFAULT;
}

/** Países (eShops) que componen cada región de comparación. */
export function paisesDeRegion(region: RegionComparacion): string[] {
  switch (region) {
    case "AR":
      return ["AR"];
    case "ES":
      return ["ES"];
    case "US":
      return ["US"];
    case "EU":
      return paisesEuropa();
  }
}

/** Todos los países cuyo precio hay que consultar. */
export function paisesAConsultar(): string[] {
  return Array.from(new Set(REGIONES_COMPARACION.flatMap(paisesDeRegion)));
}

export const NOMBRE_REGION: Record<RegionComparacion, string> = {
  AR: "Argentina",
  ES: "España",
  EU: "Europa",
  US: "Estados Unidos",
};

export function nombrePais(codigo: string): string {
  return PAISES[codigo]?.nombre ?? codigo;
}
