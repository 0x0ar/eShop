/**
 * Gift cards (tarjetas de saldo) de Nintendo eShop.
 *
 * Una gift card solo sirve en las eShops de su región y en su moneda. El
 * optimizador además exige que la moneda de la tarjeta coincida con la moneda
 * que devuelve la API de precios para ese país.
 *
 * Ver docs/decisiones.md para lo que todavía falta verificar.
 */

export interface RegionGiftCard {
  codigo: string;
  nombre: string;
  moneda: string;
  /** eShops (código de país) donde se puede canjear. */
  paises: string[];
  /** Denominaciones conocidas, en la moneda de la tarjeta. Solo se usan para el proveedor de referencia. */
  denominaciones: string[];
}

export const REGIONES_GIFTCARD: Record<string, RegionGiftCard> = {
  EU: {
    codigo: "EU",
    nombre: "Europa (EUR)",
    moneda: "EUR",
    paises: ["ES", "DE", "FR", "IT", "PT", "NL", "BE", "AT", "IE"],
    denominaciones: ["15", "25", "50", "100"],
  },
  GB: {
    codigo: "GB",
    nombre: "Reino Unido (GBP)",
    moneda: "GBP",
    paises: ["GB"],
    denominaciones: ["15", "25", "50"],
  },
  US: {
    codigo: "US",
    nombre: "Estados Unidos (USD)",
    moneda: "USD",
    paises: ["US"],
    denominaciones: ["10", "20", "35", "50", "70", "99"],
  },
};

/**
 * ¿La eShop de ese país permite pagar parte con saldo y el resto con tarjeta?
 * Por defecto `false` (conservador): las gift cards tienen que cubrir el precio
 * completo. Si se habilita, el optimizador también considera combinaciones que
 * no llegan al precio y paga la diferencia con tarjeta del exterior.
 */
export const PAGO_MIXTO_POR_PAIS: Record<string, boolean> = {};

export function permitePagoMixto(pais: string): boolean {
  return PAGO_MIXTO_POR_PAIS[pais] ?? false;
}

/**
 * Proveedores de gift cards habilitados. Se pueden desactivar sin tocar código
 * con `GIFTCARD_PROVEEDORES=instant-gaming,manual`.
 */
export const PROVEEDORES_GIFTCARD_DEFAULT = ["instant-gaming", "manual"];

export function proveedoresGiftCardHabilitados(): string[] {
  const env = process.env.GIFTCARD_PROVEEDORES;
  if (!env) return PROVEEDORES_GIFTCARD_DEFAULT;
  return env
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Región de activación de una key → eShops donde se puede canjear. */
export const PAISES_POR_REGION_KEY: Record<string, string[] | "todos"> = {
  EU: ["ES", "DE", "FR", "IT", "PT", "NL", "PL", "GB", "BE", "AT", "IE"],
  US: ["US"],
  GLOBAL: "todos",
};

export function paisesDeRegionKey(region: string): string[] | "todos" {
  return PAISES_POR_REGION_KEY[region] ?? [];
}
