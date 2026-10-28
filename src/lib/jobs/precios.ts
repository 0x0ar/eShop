import { fuentes } from "@config/fuentes";
import { PAISES, paisesAConsultar } from "@config/regiones";
import { db } from "@/lib/db";
import { diaArgentina } from "@/lib/data/cotizaciones";
import { obtenerPrecios, type PrecioNintendo } from "@/lib/sources/nintendo/precios";
import { registrarError, registrarExito, type ContextoJob, type FuncionJob } from "./runner";

async function guardarPrecio(juegoId: string, p: PrecioNintendo, ahora: Date, dia: string) {
  const datos = {
    moneda: p.moneda,
    regular: p.regular.toFixed(),
    oferta: p.oferta?.toFixed() ?? null,
    ofertaDesde: p.ofertaDesde,
    ofertaHasta: p.ofertaHasta,
    estado: p.estado,
    actualizado: ahora,
  };
  await db.precioActual.upsert({
    where: { juegoId_pais: { juegoId, pais: p.pais } },
    create: { juegoId, pais: p.pais, ...datos },
    update: datos,
  });
  const hist = { moneda: p.moneda, regular: datos.regular, oferta: datos.oferta, registrado: ahora };
  await db.precioHistorico.upsert({
    where: { juegoId_pais_dia: { juegoId, pais: p.pais, dia } },
    create: { juegoId, pais: p.pais, dia, ...hist },
    update: hist,
  });
}

/**
 * Actualiza precios de un país. `soloJuegos` limita a ciertos juegos (para el
 * job de populares). Devuelve cuántos precios se guardaron.
 */
export async function actualizarPreciosPais(pais: string, ctx: ContextoJob, soloJuegos?: string[]): Promise<number> {
  const info = PAISES[pais];
  const productos = await db.productoRegional.findMany({
    where: { catalogo: info.catalogo, juegoId: soloJuegos ? { in: soloJuegos } : { not: null } },
    select: { nsuid: true, juegoId: true },
    orderBy: { popularidad: "desc" },
  });
  const juegoPorNsuid = new Map(productos.map((p) => [p.nsuid, p.juegoId!]));
  const nsuids = Array.from(juegoPorNsuid.keys());
  const max = fuentes.nintendoPrecios.maxIdsPorRequest();
  const ahora = new Date();
  const dia = diaArgentina(ahora);
  let guardados = 0;
  let fallos = 0;
  let ultimoError: unknown = null;
  for (let i = 0; i < nsuids.length; i += max) {
    const lote = nsuids.slice(i, i + max);
    try {
      const { precios, sinPrecio } = await obtenerPrecios(pais, info.idiomaPrecios, lote);
      for (const p of precios) {
        const juegoId = juegoPorNsuid.get(p.nsuid);
        if (!juegoId) continue;
        await guardarPrecio(juegoId, { ...p, pais }, ahora, dia);
        guardados++;
        ctx.contar();
      }
      // Lo que ya no está a la venta en ese país deja de mostrarse (el historial queda).
      const quitar = sinPrecio.map((s) => juegoPorNsuid.get(s.nsuid)).filter((id): id is string => Boolean(id));
      if (quitar.length) await db.precioActual.deleteMany({ where: { pais, juegoId: { in: quitar } } });
    } catch (e) {
      fallos++;
      ultimoError = e;
      ctx.log(`${pais}: falló el lote ${i / max + 1}: ${(e as Error).message}`);
      // Si fallan los primeros lotes seguidos, la fuente está caída: no insistir.
      if (fallos >= 3 && guardados === 0) break;
    }
  }
  const fuente = `nintendo-precios-${pais}`;
  if (guardados === 0 && ultimoError) await registrarError(fuente, ultimoError);
  else await registrarExito(fuente, `${guardados} precios${fallos ? `, ${fallos} lotes fallidos` : ""}`);
  ctx.log(`${pais}: ${guardados} precios (${nsuids.length} productos, ${fallos} lotes fallidos)`);
  return guardados;
}

export const jobPrecios: FuncionJob = async (ctx) => {
  const resumen: string[] = [];
  let total = 0;
  for (const pais of paisesAConsultar()) {
    const n = await actualizarPreciosPais(pais, ctx);
    total += n;
    resumen.push(`${pais}:${n}`);
  }
  if (total === 0) throw new Error("No se pudo actualizar ningún precio");
  return resumen.join(" ");
};

/** Solo los N juegos más populares (para una actualización rápida y para la carga inicial). */
export function jobPopulares(cantidad = Number(process.env.POPULARES_CANTIDAD ?? 100)): FuncionJob {
  return async (ctx) => {
    const juegos = await db.juego.findMany({
      where: { origen: "nintendo", tipo: { in: ["JUEGO", "SWITCH2_EDITION", "EDICION_ESPECIAL"] } },
      orderBy: { popularidad: "desc" },
      take: cantidad,
      select: { id: true },
    });
    const ids = juegos.map((j) => j.id);
    let total = 0;
    for (const pais of paisesAConsultar()) total += await actualizarPreciosPais(pais, ctx, ids);
    if (total === 0) throw new Error("No se pudo actualizar ningún precio");
    return `${ids.length} juegos, ${total} precios`;
  };
}
