import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { dec } from "@/lib/domain/dinero";
import type { ProveedorGiftCards } from "./proveedor";

/**
 * Proveedor "manual": ofertas cargadas a mano en config/giftcards-manual.json.
 * Sirve para tiendas sin datos accesibles (o mientras se arregla un scraper).
 * Cada entrada declara la tienda y si es marketplace.
 */

const entradaSchema = z.object({
  tienda: z.string(),
  esMarketplace: z.boolean().default(false),
  regionTarjeta: z.string(),
  monedaTarjeta: z.string(),
  valor: z.union([z.string(), z.number()]),
  precio: z.union([z.string(), z.number()]),
  monedaPrecio: z.string(),
  url: z.string().url().nullable().default(null),
  disponible: z.boolean().default(true),
});

export const archivoManualSchema = z.object({ ofertas: z.array(entradaSchema) });

export async function leerOfertasManuales() {
  let texto: string;
  try {
    texto = await readFile(path.join(process.cwd(), "config", "giftcards-manual.json"), "utf8");
  } catch {
    return [];
  }
  return archivoManualSchema.parse(JSON.parse(texto)).ofertas;
}

/** Cada tienda del archivo se publica como su propio "proveedor" para que la UI muestre el nombre real. */
export const proveedorManual: ProveedorGiftCards = {
  id: "manual",
  nombre: "Carga manual",
  esMarketplace: false,
  async obtenerOfertas({ log }) {
    const ofertas = await leerOfertasManuales();
    log(`Manual: ${ofertas.length} gift cards`);
    return ofertas.map((o) => ({
      regionTarjeta: o.regionTarjeta,
      monedaTarjeta: o.monedaTarjeta,
      valor: dec(String(o.valor)),
      precio: dec(String(o.precio)),
      monedaPrecio: o.monedaPrecio,
      url: o.url,
      titulo: o.tienda,
      disponible: o.disponible,
      tienda: o.tienda,
      esMarketplace: o.esMarketplace,
    }));
  },
};
