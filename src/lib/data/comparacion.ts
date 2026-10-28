import { db } from "@/lib/db";
import { dec } from "@/lib/domain/dinero";
import { calcularOpciones, type OfertaGiftCard, type OfertaKey, type PrecioTienda } from "@/lib/domain/opciones";
import type { Cotizaciones } from "@/lib/domain/cotizaciones";
import type { OpcionDTO } from "@/lib/domain/tipos";

type FilaPrecio = Awaited<ReturnType<typeof db.precioActual.findMany>>[number];
type FilaKey = Awaited<ReturnType<typeof db.ofertaKey.findMany>>[number];
type FilaGiftCard = Awaited<ReturnType<typeof db.ofertaGiftCard.findMany>>[number];

export function aPrecioTienda(p: FilaPrecio, urls: Record<string, string>): PrecioTienda {
  const vigente = p.ofertaHasta == null || p.ofertaHasta > new Date();
  return {
    pais: p.pais,
    moneda: p.moneda,
    regular: dec(p.regular.toString()),
    oferta: p.oferta && vigente ? dec(p.oferta.toString()) : null,
    ofertaHasta: vigente ? p.ofertaHasta : null,
    actualizado: p.actualizado,
    url: urls[p.pais] ?? null,
  };
}

export function aOfertaKey(k: FilaKey): OfertaKey {
  return {
    proveedor: k.proveedor,
    nombreProveedor: k.nombreProveedor,
    esMarketplace: k.esMarketplace,
    titulo: k.titulo,
    precio: dec(k.precio.toString()),
    moneda: k.moneda,
    regionActivacion: k.regionActivacion,
    url: k.url,
    disponible: k.disponible,
    actualizado: k.actualizado,
  };
}

export function aOfertaGiftCard(g: FilaGiftCard): OfertaGiftCard {
  return {
    proveedor: g.proveedor,
    nombreProveedor: g.nombreProveedor,
    esMarketplace: g.esMarketplace,
    regionTarjeta: g.regionTarjeta,
    monedaTarjeta: g.monedaTarjeta,
    valor: dec(g.valor.toString()),
    precio: dec(g.precio.toString()),
    monedaPrecio: g.monedaPrecio,
    url: g.url,
    disponible: g.disponible,
    actualizado: g.actualizado,
  };
}

/** Une los enlaces por país de los productos regionales de un juego. */
export function unirUrls(productos: { urls: unknown }[]): Record<string, string> {
  const urls: Record<string, string> = {};
  for (const p of productos) {
    if (p.urls && typeof p.urls === "object") {
      for (const [pais, url] of Object.entries(p.urls as Record<string, unknown>)) {
        if (typeof url === "string") urls[pais] = url;
      }
    }
  }
  return urls;
}

export async function giftCardsVigentes(): Promise<OfertaGiftCard[]> {
  return (await db.ofertaGiftCard.findMany({ where: { disponible: true } })).map(aOfertaGiftCard);
}

/** Calcula la comparativa de un juego con los datos guardados. */
export async function opcionesDeJuego(
  juegoId: string,
  cotizaciones: Cotizaciones,
  giftcards?: OfertaGiftCard[],
): Promise<OpcionDTO[]> {
  const [precios, keys, productos, gcs] = await Promise.all([
    db.precioActual.findMany({ where: { juegoId } }),
    db.ofertaKey.findMany({ where: { juegoId } }),
    db.productoRegional.findMany({ where: { juegoId }, select: { urls: true } }),
    giftcards ? Promise.resolve(giftcards) : giftCardsVigentes(),
  ]);
  const urls = unirUrls(productos);
  return calcularOpciones({
    precios: precios.map((p) => aPrecioTienda(p, urls)),
    keys: keys.map(aOfertaKey),
    giftcards: gcs,
    cotizaciones,
  });
}
