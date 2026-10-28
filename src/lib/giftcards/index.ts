import { proveedoresGiftCardHabilitados } from "@config/giftcards";
import { proveedorInstantGaming } from "./instantGaming";
import { proveedorManual } from "./manual";
import type { ProveedorGiftCards } from "./proveedor";

/** Registro de proveedores disponibles. Agregar acá las tiendas nuevas. */
export const PROVEEDORES_GIFTCARDS: Record<string, ProveedorGiftCards> = {
  [proveedorInstantGaming.id]: proveedorInstantGaming,
  [proveedorManual.id]: proveedorManual,
};

export function proveedoresActivos(): ProveedorGiftCards[] {
  return proveedoresGiftCardHabilitados()
    .map((id) => PROVEEDORES_GIFTCARDS[id])
    .filter((p): p is ProveedorGiftCards => Boolean(p));
}

export type { ProveedorGiftCards } from "./proveedor";
