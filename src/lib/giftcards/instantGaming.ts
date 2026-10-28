import { REGIONES_GIFTCARD } from "@config/giftcards";
import { pedirPagina } from "@/lib/sources/http";
import {
  RUTAS,
  enlacesFichas,
  esFichaGiftCard,
  etiquetaRegion,
  parsearFicha,
  parsearTituloGiftCard,
  urlInstantGaming,
} from "@/lib/sources/instantGaming";
import type { OfertaGiftCardProveedor, ProveedorGiftCards } from "./proveedor";

/** Tope de fichas a visitar (cada una tarda el intervalo de scraping). */
const MAX_FICHAS = Number(process.env.INSTANT_GAMING_MAX_GIFTCARDS ?? 30);

/**
 * Gift cards de eShop en Instant Gaming: se parte de la categoría de tarjetas
 * regalo y se recorren las variantes que enlaza cada ficha (10/20/35/50 USD,
 * 25 GBP…). La región sale de los países de activación de la ficha.
 */
export const proveedorInstantGaming: ProveedorGiftCards = {
  id: "instant-gaming",
  nombre: "Instant Gaming",
  esMarketplace: false,
  async obtenerOfertas({ cache, log }) {
    const pendientes = enlacesFichas(await pedirPagina(urlInstantGaming(RUTAS.giftcards()), cache)).filter(
      esFichaGiftCard,
    );
    const visitadas = new Set<string>();
    const ofertas = new Map<string, OfertaGiftCardProveedor>();
    while (pendientes.length > 0 && visitadas.size < MAX_FICHAS) {
      const url = pendientes.shift()!;
      if (visitadas.has(url)) continue;
      visitadas.add(url);
      const html = await pedirPagina(url, cache);
      for (const otra of enlacesFichas(html).filter(esFichaGiftCard)) if (!visitadas.has(otra)) pendientes.push(otra);
      const ficha = parsearFicha(html);
      if (!ficha) continue;
      const gc = parsearTituloGiftCard(`${ficha.titulo} ${ficha.tituloCompleto}`);
      if (!gc) continue;
      // La región declarada por la tienda manda sobre la que se deduce de la moneda.
      const etiqueta = etiquetaRegion(ficha.paisesActivacion);
      const soloGB = ficha.paisesActivacion.length === 1 && ficha.paisesActivacion[0] === "GB";
      const region = etiqueta === "US" ? "US" : soloGB ? "GB" : gc.region;
      if (!REGIONES_GIFTCARD[region] || REGIONES_GIFTCARD[region].moneda !== gc.moneda) {
        log(`Gift card ignorada (región/moneda inconsistente): ${ficha.tituloCompleto}`);
        continue;
      }
      const clave = `${region}:${gc.moneda}:${gc.valor.toFixed()}`;
      const actual = ofertas.get(clave);
      if (actual && actual.precio.lte(ficha.precio)) continue;
      ofertas.set(clave, {
        regionTarjeta: region,
        monedaTarjeta: gc.moneda,
        valor: gc.valor,
        precio: ficha.precio,
        monedaPrecio: ficha.moneda,
        url: ficha.url || url,
        titulo: ficha.tituloCompleto,
        disponible: ficha.disponible,
      });
    }
    log(`Instant Gaming: ${ofertas.size} gift cards (${visitadas.size} fichas visitadas)`);
    return Array.from(ofertas.values());
  },
};
