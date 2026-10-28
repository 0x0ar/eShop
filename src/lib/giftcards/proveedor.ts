import type Decimal from "decimal.js";
import type { CacheHttp } from "@/lib/sources/http";

/** Oferta de gift card tal como la devuelve un proveedor. */
export interface OfertaGiftCardProveedor {
  regionTarjeta: string;
  monedaTarjeta: string;
  valor: Decimal;
  precio: Decimal;
  monedaPrecio: string;
  url: string | null;
  titulo: string | null;
  disponible: boolean;
  /** Para proveedores que agrupan varias tiendas (ej. carga manual): nombre real de la tienda. */
  tienda?: string;
  esMarketplace?: boolean;
}

export interface ContextoProveedor {
  cache: CacheHttp | null;
  log: (mensaje: string) => void;
}

/**
 * Interfaz común de las tiendas de gift cards. Para agregar una tienda:
 * implementar esta interfaz, registrarla en src/lib/giftcards/index.ts y
 * habilitarla en GIFTCARD_PROVEEDORES.
 */
export interface ProveedorGiftCards {
  id: string;
  nombre: string;
  /** true si vende a través de terceros (marketplace); se marca en la UI. */
  esMarketplace: boolean;
  obtenerOfertas(ctx: ContextoProveedor): Promise<OfertaGiftCardProveedor[]>;
}
