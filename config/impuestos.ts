/**
 * Impuestos argentinos aplicados sobre el costo en ARS.
 *
 * Este es el ÚNICO lugar donde se define qué impuesto se aplica y a qué método
 * de pago. Las tasas son strings para que se lean con aritmética decimal exacta.
 *
 * Por defecto el IVA (21 %) solo se aplica al pago con tarjeta argentina.
 * Si pagás gift cards o keys con tarjeta argentina, agregá "gift_card" y/o
 * "key_ig" a `aplicaA`.
 */

export const METODOS_PAGO = ["tarjeta_ar", "tarjeta_exterior", "gift_card", "key_ig"] as const;
export type MetodoPago = (typeof METODOS_PAGO)[number];

export interface Impuesto {
  id: string;
  nombre: string;
  /** Tasa como fracción decimal en string: "0.21" = 21 %. */
  tasa: string;
  aplicaA: MetodoPago[];
}

export const IMPUESTOS: Impuesto[] = [
  {
    id: "iva",
    nombre: "IVA servicios digitales",
    tasa: "0.21",
    aplicaA: ["tarjeta_ar"],
  },
];

export const NOMBRE_METODO: Record<MetodoPago, string> = {
  tarjeta_ar: "Tarjeta argentina",
  tarjeta_exterior: "Tarjeta del exterior",
  gift_card: "Gift card de eShop",
  key_ig: "Key en Instant Gaming",
};
