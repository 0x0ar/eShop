import type { MetodoPago } from "@config/impuestos";
import type { TipoCotizacion } from "@config/monedas";
import type { RegionComparacion } from "@config/regiones";

/**
 * Tipos serializables (sin Decimal) que viajan del servidor al cliente.
 * Los montos van como string decimal ("12345.67").
 */

export type Requisito =
  | { tipo: "cuenta"; paises: string[] }
  | { tipo: "tarjeta_ar"; pais: string }
  | { tipo: "tarjeta_exterior"; pais: string }
  | { tipo: "gift_card"; region: string }
  | { tipo: "key_region"; region: string }
  | { tipo: "marketplace"; tiendas: string[] }
  | { tipo: "pago_mixto"; pais: string };

export interface LineaGiftCardDTO {
  proveedor: string;
  nombreProveedor: string;
  esMarketplace: boolean;
  regionTarjeta: string;
  valor: string;
  moneda: string;
  precio: string;
  monedaPrecio: string;
  cantidad: number;
  costoArsUnitario: string;
  url: string | null;
}

export interface DetalleGiftCardDTO {
  lineas: LineaGiftCardDTO[];
  valorTotal: string;
  sobrante: string;
  restante: string;
  costoRestanteArs: string;
  moneda: string;
}

export interface DetalleKeyDTO {
  proveedor: string;
  nombreProveedor: string;
  titulo: string;
  precio: string;
  moneda: string;
  regionActivacion: string;
  url: string;
  esMarketplace: boolean;
}

export interface ImpuestoDTO {
  nombre: string;
  tasa: string;
  monto: string;
}

export interface CeldaDTO {
  region: RegionComparacion;
  metodo: MetodoPago;
  tipo: TipoCotizacion;
  pais: string;
  /** Costo final en ARS. */
  ars: string;
  arsSinImpuestos: string;
  impuestos: ImpuestoDTO[];
  /** Precio de la eShop (o de la key) en su moneda. */
  precio: string;
  precioRegular: string | null;
  moneda: string;
  enOferta: boolean;
  ofertaHasta: string | null;
  monedaPuente: string;
  cotizacion: string;
  actualizado: string;
  url: string | null;
  requisitos: Requisito[];
  giftcards?: DetalleGiftCardDTO;
  key?: DetalleKeyDTO;
}

export interface OpcionDTO {
  id: string;
  region: RegionComparacion;
  metodo: MetodoPago;
  /** Candidatos por cotización, ordenados de más barato a más caro (uno por país). */
  candidatos: Record<TipoCotizacion, CeldaDTO[]>;
  motivoNoDisponible: string | null;
}

export interface PerfilUsuario {
  /** Países donde el usuario tiene cuenta de Nintendo. `null` = no filtrar. */
  cuentas: string[] | null;
  tarjetaArgentina: boolean;
  tarjetaExterior: boolean;
  giftCards: boolean;
  marketplaces: boolean;
  keys: boolean;
}

export const PERFIL_COMPLETO: PerfilUsuario = {
  cuentas: null,
  tarjetaArgentina: true,
  tarjetaExterior: true,
  giftCards: true,
  marketplaces: true,
  keys: true,
};
