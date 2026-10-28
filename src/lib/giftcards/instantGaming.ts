import { REGIONES_GIFTCARD } from "@config/giftcards";
import { pedirPagina } from "@/lib/sources/http";
import { parsearListado, parsearTituloGiftCard, urlListado } from "@/lib/sources/instantGaming";
import type { OfertaGiftCardProveedor, ProveedorGiftCards } from "./proveedor";

const MAX_PAGINAS = 5;

export const proveedorInstantGaming: ProveedorGiftCards = {
  id: "instant-gaming",
  nombre: "Instant Gaming",
  esMarketplace: false,
  async obtenerOfertas({ cache, log }) {
    const ofertas = new Map<string, OfertaGiftCardProveedor>();
    for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
      const html = await pedirPagina(urlListado("giftcards", pagina), cache);
      const { items, haySiguiente } = parsearListado(html);
      for (const item of items) {
        const gc = parsearTituloGiftCard(item.titulo);
        if (!gc || !REGIONES_GIFTCARD[gc.region]) continue;
        const clave = `${gc.region}:${gc.moneda}:${gc.valor.toFixed()}`;
        const actual = ofertas.get(clave);
        if (actual && actual.precio.lte(item.precio)) continue;
        ofertas.set(clave, {
          regionTarjeta: gc.region,
          monedaTarjeta: gc.moneda,
          valor: gc.valor,
          precio: item.precio,
          monedaPrecio: item.moneda,
          url: item.url,
          titulo: item.titulo,
          disponible: item.disponible,
        });
      }
      if (!haySiguiente || items.length === 0) break;
    }
    log(`Instant Gaming: ${ofertas.size} gift cards`);
    return Array.from(ofertas.values());
  },
};
