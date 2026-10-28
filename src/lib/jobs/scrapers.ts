import { db } from "@/lib/db";
import { similitud, slugificar } from "@/lib/domain/texto";
import { proveedoresActivos } from "@/lib/giftcards";
import { BloqueadoPorRobotsError, pedirPagina } from "@/lib/sources/http";
import { limpiarTituloKey, parsearListado, parsearRegionProducto, regionActivacion, urlListado } from "@/lib/sources/instantGaming";
import { cacheHttpDb, registrarError, registrarExito, type ContextoJob, type FuncionJob } from "./runner";

const MAX_PAGINAS_KEYS = Number(process.env.INSTANT_GAMING_MAX_PAGINAS ?? 40);

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
  titulos: string[];
}

/** Busca el juego del catálogo que corresponde al título de una key. */
export function matchearKey(tituloKey: string, juegos: CandidatoJuego[], indice: Map<string, CandidatoJuego[]>): string | null {
  const limpio = limpiarTituloKey(tituloKey);
  if (!limpio) return null;
  const primera = limpio.split(" ")[0];
  let mejor: { id: string; s: number } | null = null;
  for (const j of indice.get(primera) ?? juegos) {
    for (const t of j.titulos) {
      const s = t === limpio ? 1 : similitud(t, limpio);
      if (!mejor || s > mejor.s) mejor = { id: j.id, s };
    }
  }
  return mejor && mejor.s >= 0.92 ? mejor.id : null;
}

/** Keys de juegos de Switch en Instant Gaming. */
export async function actualizarKeys(ctx: ContextoJob): Promise<number> {
  const productos = await db.productoRegional.findMany({
    where: { juegoId: { not: null } },
    select: { juegoId: true, titulo: true },
  });
  const porJuego = new Map<string, Set<string>>();
  for (const p of productos) {
    const s = porJuego.get(p.juegoId!) ?? new Set<string>();
    s.add(limpiarTituloKey(p.titulo));
    porJuego.set(p.juegoId!, s);
  }
  const juegos: CandidatoJuego[] = Array.from(porJuego, ([id, t]) => ({ id, titulos: Array.from(t) }));
  const indice = new Map<string, CandidatoJuego[]>();
  for (const j of juegos) {
    for (const t of j.titulos) {
      const k = t.split(" ")[0];
      const l = indice.get(k) ?? [];
      if (!l.includes(j)) l.push(j);
      indice.set(k, l);
    }
  }

  const ahora = new Date();
  const vistas = new Set<string>();
  let guardadas = 0;
  let sinMatch = 0;
  for (let pagina = 1; pagina <= MAX_PAGINAS_KEYS; pagina++) {
    const { items, haySiguiente } = parsearListado(await pedirPagina(urlListado("keys", pagina), cacheHttpDb));
    for (const item of items) {
      if (/gift|card|tarjeta|e-?shop \d|suscripci|membership|online/i.test(item.titulo)) continue;
      const juegoId = matchearKey(item.titulo, juegos, indice);
      if (!juegoId) {
        sinMatch++;
        continue;
      }
      let region = regionActivacion(item.titulo);
      if (!region) {
        try {
          region = parsearRegionProducto(await pedirPagina(item.url, cacheHttpDb));
        } catch (e) {
          if (e instanceof BloqueadoPorRobotsError) ctx.log(e.message);
          else throw e;
        }
      }
      // Sin región confirmada no se publica: no adivinamos dónde se activa.
      if (!region) continue;
      const datos = {
        nombreProveedor: "Instant Gaming",
        esMarketplace: false,
        juegoId,
        titulo: item.titulo,
        precio: item.precio.toFixed(),
        moneda: item.moneda,
        regionActivacion: region,
        disponible: item.disponible,
        actualizado: ahora,
      };
      await db.ofertaKey.upsert({
        where: { proveedor_url: { proveedor: "instant-gaming", url: item.url } },
        create: { proveedor: "instant-gaming", url: item.url, ...datos },
        update: datos,
      });
      vistas.add(item.url);
      guardadas++;
      ctx.contar();
    }
    if (!haySiguiente || items.length === 0) break;
  }
  await db.ofertaKey.updateMany({
    where: { proveedor: "instant-gaming", url: { notIn: Array.from(vistas) } },
    data: { disponible: false },
  });
  ctx.log(`Keys: ${guardadas} guardadas, ${sinMatch} sin juego equivalente`);
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
