import { db } from "@/lib/db";
import { cotizacionesVigentes } from "@/lib/data/cotizaciones";
import { aOfertaKey, aPrecioTienda, giftCardsVigentes, regionesSinDatos, unirUrls } from "@/lib/data/comparacion";
import { calcularOpciones } from "@/lib/domain/opciones";
import { recomendar } from "@/lib/domain/recomendacion";
import { PERFIL_COMPLETO } from "@/lib/domain/tipos";
import type { FuncionJob } from "./runner";

/**
 * Precalcula en cada juego el mejor costo en ARS (perfil completo), la
 * referencia argentina y si está en oferta. Lo usan la búsqueda y el inicio.
 */
export const jobResumen: FuncionJob = async ({ contar, log }) => {
  const { cotizaciones, faltantes } = await cotizacionesVigentes();
  if (!cotizaciones) throw new Error(`Faltan cotizaciones: ${faltantes.join(", ")}`);
  const giftcards = await giftCardsVigentes();
  const juegos = await db.juego.findMany({ select: { id: true } });
  const lote = 200;
  let conPrecio = 0;
  for (let i = 0; i < juegos.length; i += lote) {
    const ids = juegos.slice(i, i + lote).map((j) => j.id);
    const [precios, keys, productos] = await Promise.all([
      db.precioActual.findMany({ where: { juegoId: { in: ids } } }),
      db.ofertaKey.findMany({ where: { juegoId: { in: ids } } }),
      db.productoRegional.findMany({ where: { juegoId: { in: ids } }, select: { juegoId: true, urls: true } }),
    ]);
    for (const id of ids) {
      const urls = unirUrls(productos.filter((p) => p.juegoId === id));
      const ps = precios.filter((p) => p.juegoId === id).map((p) => aPrecioTienda(p, urls));
      const opciones = calcularOpciones({
        regionesSinDatos: regionesSinDatos(),
        precios: ps,
        keys: keys.filter((k) => k.juegoId === id).map(aOfertaKey),
        giftcards,
        cotizaciones,
      });
      const rec = recomendar(opciones, PERFIL_COMPLETO);
      let descuentoMax = 0;
      for (const p of ps) {
        if (p.oferta && p.regular.gt(0)) {
          const pct = Math.round(p.regular.sub(p.oferta).div(p.regular).mul(100).toNumber());
          descuentoMax = Math.max(descuentoMax, pct);
        }
      }
      if (ps.length) conPrecio++;
      await db.juego.update({
        where: { id },
        data: {
          mejorArsOficial: rec.mejorPorTipo.oficial?.ars ?? null,
          mejorArsBlue: rec.mejorPorTipo.blue?.ars ?? null,
          referenciaArsOficial: rec.referenciaPorTipo.oficial?.ars ?? null,
          enOferta: descuentoMax > 0,
          descuentoMax,
          resumenActualizado: new Date(),
        },
      });
      contar();
    }
  }
  log(`${juegos.length} juegos, ${conPrecio} con precio`);
  return `${conPrecio} juegos con precio`;
};
