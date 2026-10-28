import { db } from "@/lib/db";
import { similitud, slugificar } from "@/lib/domain/texto";
import { proveedoresActivos } from "@/lib/giftcards";
import { BloqueadoPorRobotsError, pedirPagina } from "@/lib/sources/http";
import {
  RUTAS,
  enlacesFichas,
  enlacesGeneros,
  esFichaGiftCard,
  etiquetaRegion,
  limpiarTituloKey,
  parsearFicha,
  plataformaDeTitulo,
  urlInstantGaming,
} from "@/lib/sources/instantGaming";
import { cacheHttpDb, registrarError, registrarExito, type ContextoJob, type FuncionJob } from "./runner";

/** Actualiza las gift cards de todos los proveedores habilitados. */
export async function actualizarGiftCards(ctx: ContextoJob): Promise<string[]> {
  const errores: string[] = [];
  for (const proveedor of proveedoresActivos()) {
    try {
      const ofertas = await proveedor.obtenerOfertas({ cache: cacheHttpDb, log: ctx.log });
      const ahora = new Date();
      const idsVistos = new Set<string>();
      const proveedoresTocados = new Set<string>([proveedor.id]);
      for (const o of ofertas) {
        const id = o.tienda ? `${proveedor.id}:${slugificar(o.tienda)}` : proveedor.id;
        proveedoresTocados.add(id);
        const clave = {
          proveedor: id,
          regionTarjeta: o.regionTarjeta,
          monedaTarjeta: o.monedaTarjeta,
          valor: o.valor.toFixed(),
        };
        const datos = {
          nombreProveedor: o.tienda ?? proveedor.nombre,
          esMarketplace: o.esMarketplace ?? proveedor.esMarketplace,
          precio: o.precio.toFixed(),
          monedaPrecio: o.monedaPrecio,
          url: o.url,
          titulo: o.titulo,
          disponible: o.disponible,
          actualizado: ahora,
        };
        const fila = await db.ofertaGiftCard.upsert({
          where: { proveedor_regionTarjeta_monedaTarjeta_valor: clave },
          create: { ...clave, ...datos },
          update: datos,
        });
        idsVistos.add(fila.id);
        ctx.contar();
      }
      // Lo que el proveedor dejó de listar se marca como no disponible.
      await db.ofertaGiftCard.updateMany({
        where: {
          OR: Array.from(proveedoresTocados).map((p) => ({ proveedor: { startsWith: p } })),
          id: { notIn: Array.from(idsVistos) },
        },
        data: { disponible: false },
      });
      await registrarExito(`giftcards-${proveedor.id}`, `${ofertas.length} ofertas`);
    } catch (e) {
      errores.push(`${proveedor.nombre}: ${(e as Error).message}`);
      ctx.log(`Gift cards ${proveedor.nombre}: ${(e as Error).message}`);
      await registrarError(`giftcards-${proveedor.id}`, e);
    }
  }
  return errores;
}

interface CandidatoJuego {
  id: string;
  plataforma: string;
  titulos: string[];
}

/** Busca el juego del catálogo que corresponde al título de una key (misma plataforma si se puede deducir). */
export function matchearKey(
  tituloKey: string,
  juegos: CandidatoJuego[],
  indice: Map<string, CandidatoJuego[]>,
): string | null {
  const limpio = limpiarTituloKey(tituloKey);
  if (!limpio) return null;
  const plataforma = plataformaDeTitulo(tituloKey);
  const primera = limpio.split(" ")[0];
  let mejor: { id: string; s: number } | null = null;
  for (const j of indice.get(primera) ?? juegos) {
    if (plataforma && j.plataforma !== plataforma && j.plataforma !== "AMBAS") continue;
    for (const t of j.titulos) {
      const s = t === limpio ? 1 : similitud(t, limpio);
      if (!mejor || s > mejor.s) mejor = { id: j.id, s };
    }
  }
  return mejor && mejor.s >= 0.92 ? mejor.id : null;
}

/** Tope de fichas de producto a visitar por corrida (cada una espera el intervalo de scraping). */
const MAX_FICHAS_KEYS = Number(process.env.INSTANT_GAMING_MAX_PRODUCTOS ?? 300);

/**
 * Keys de juegos de Switch en Instant Gaming. Solo se recorren rutas que
 * robots.txt permite: categorías de Nintendo (y sus géneros) para descubrir
 * fichas, y cada ficha para precio, stock y países de activación.
 */
export async function actualizarKeys(ctx: ContextoJob): Promise<number> {
  const productos = await db.productoRegional.findMany({
    where: { juegoId: { not: null } },
    select: { juegoId: true, titulo: true, juego: { select: { plataforma: true } } },
  });
  const porJuego = new Map<string, CandidatoJuego>();
  for (const p of productos) {
    const j = porJuego.get(p.juegoId!) ?? { id: p.juegoId!, plataforma: p.juego?.plataforma ?? "SWITCH", titulos: [] };
    const t = limpiarTituloKey(p.titulo);
    if (t && !j.titulos.includes(t)) j.titulos.push(t);
    porJuego.set(p.juegoId!, j);
  }
  const juegos = Array.from(porJuego.values());
  const indice = new Map<string, CandidatoJuego[]>();
  for (const j of juegos) {
    for (const t of j.titulos) {
      const k = t.split(" ")[0];
      const l = indice.get(k) ?? [];
      if (!l.includes(j)) l.push(j);
      indice.set(k, l);
    }
  }

  // 1. Descubrir fichas desde las categorías permitidas (y los géneros que enlazan).
  const categorias = RUTAS.categoriasKeys().map(urlInstantGaming);
  const fichas = new Set<string>();
  const vistasCategorias = new Set<string>();
  while (categorias.length > 0) {
    const url = categorias.shift()!;
    if (vistasCategorias.has(url)) continue;
    vistasCategorias.add(url);
    let html: string;
    try {
      html = await pedirPagina(url, cacheHttpDb);
    } catch (e) {
      if (e instanceof BloqueadoPorRobotsError) {
        ctx.log(e.message);
        continue;
      }
      throw e;
    }
    for (const f of enlacesFichas(html)) if (!esFichaGiftCard(f)) fichas.add(f);
    for (const g of enlacesGeneros(html)) if (!vistasCategorias.has(g)) categorias.push(g);
  }
  ctx.log(`Keys: ${fichas.size} fichas descubiertas en ${vistasCategorias.size} categorías`);

  // 2. Visitar cada ficha.
  const ahora = new Date();
  const vistas = new Set<string>();
  let guardadas = 0;
  let sinMatch = 0;
  let sinPaises = 0;
  for (const url of Array.from(fichas).slice(0, MAX_FICHAS_KEYS)) {
    const ficha = parsearFicha(await pedirPagina(url, cacheHttpDb));
    if (!ficha || !ficha.esNintendo) continue;
    // Sin países de activación de las eShops configuradas no se publica: no adivinamos.
    const region = etiquetaRegion(ficha.paisesActivacion);
    if (!region) {
      sinPaises++;
      continue;
    }
    const juegoId = matchearKey(ficha.titulo, juegos, indice);
    if (!juegoId) {
      sinMatch++;
      continue;
    }
    const urlFicha = ficha.url || url;
    const datos = {
      nombreProveedor: "Instant Gaming",
      esMarketplace: false,
      juegoId,
      titulo: ficha.tituloCompleto,
      precio: ficha.precio.toFixed(),
      moneda: ficha.moneda,
      regionActivacion: region,
      paisesActivacion: ficha.paisesActivacion,
      disponible: ficha.disponible,
      actualizado: ahora,
    };
    await db.ofertaKey.upsert({
      where: { proveedor_url: { proveedor: "instant-gaming", url: urlFicha } },
      create: { proveedor: "instant-gaming", url: urlFicha, ...datos },
      update: datos,
    });
    vistas.add(urlFicha);
    guardadas++;
    ctx.contar();
  }
  await db.ofertaKey.updateMany({
    where: { proveedor: "instant-gaming", url: { notIn: Array.from(vistas) } },
    data: { disponible: false },
  });
  ctx.log(
    `Keys: ${guardadas} guardadas, ${sinMatch} sin juego equivalente, ${sinPaises} sin países de activación conocidos`,
  );
  return guardadas;
}

export const jobScrapers: FuncionJob = async (ctx) => {
  const errores = await actualizarGiftCards(ctx);
  try {
    const n = await actualizarKeys(ctx);
    await registrarExito("instant-gaming-keys", `${n} keys`);
  } catch (e) {
    errores.push(`Keys IG: ${(e as Error).message}`);
    await registrarError("instant-gaming-keys", e);
  }
  return errores.length ? `con errores: ${errores.join(" | ")}` : "ok";
};
