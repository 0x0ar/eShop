import { readFile } from "node:fs/promises";
import path from "node:path";
import { fuentes } from "@config/fuentes";
import { PAISES, paisesEuropa } from "@config/regiones";
import { db } from "@/lib/db";
import {
  matchearCatalogos,
  type OverrideMatcheo,
  type Plataforma,
  type ProductoRegional,
  type TipoProducto,
} from "@/lib/domain/matcheo";
import { normalizarTitulo, slugificar } from "@/lib/domain/texto";
import { descargarCatalogoAmericas } from "@/lib/sources/nintendo/americas";
import type { ProductoCatalogo } from "@/lib/sources/nintendo/catalogo";
import { descargarCatalogoEuropa, descargarEnlacesEuropa } from "@/lib/sources/nintendo/europa";
import { registrarError, registrarExito, type ContextoJob, type FuncionJob } from "./runner";

type Catalogo = "AMERICAS" | "EUROPA";

export function limiteCatalogo(): number | undefined {
  const n = Number(process.env.CATALOGO_LIMITE ?? 0);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function paisesDeCatalogo(catalogo: Catalogo): string[] {
  return Object.values(PAISES)
    .filter((p) => p.catalogo === catalogo)
    .map((p) => p.codigo);
}

async function guardarProductos(catalogo: Catalogo, productos: ProductoCatalogo[], ctx: ContextoJob) {
  const existentes = new Map(
    (await db.productoRegional.findMany({ where: { catalogo }, select: { nsuid: true, urls: true } })).map((p) => [
      p.nsuid,
      p.urls,
    ]),
  );
  for (const p of productos) {
    const urlsPrevias = (existentes.get(p.nsuid) as Record<string, string> | null | undefined) ?? {};
    const datos = {
      titulo: p.titulo,
      editor: p.editor,
      plataforma: p.plataforma,
      tipo: p.tipo,
      lanzamiento: p.lanzamiento,
      imagenUrl: p.imagenUrl,
      descripcion: p.descripcion,
      popularidad: p.popularidad,
      urls: { ...urlsPrevias, ...p.urls },
    };
    await db.productoRegional.upsert({
      where: { catalogo_nsuid: { catalogo, nsuid: p.nsuid } },
      create: { catalogo, nsuid: p.nsuid, ...datos },
      update: datos,
    });
    ctx.contar();
  }
}

async function leerOverrides(): Promise<OverrideMatcheo[]> {
  const deBase = await db.matchOverride.findMany();
  let deArchivo: OverrideMatcheo[] = [];
  try {
    const json = JSON.parse(await readFile(path.join(process.cwd(), "config", "match-overrides.json"), "utf8"));
    deArchivo = (json.overrides ?? []) as OverrideMatcheo[];
  } catch {
    // archivo opcional
  }
  return [...deArchivo, ...deBase.map((o) => ({ nsuidAmericas: o.nsuidAmericas, nsuidEuropa: o.nsuidEuropa }))];
}

type FilaProducto = Awaited<ReturnType<typeof db.productoRegional.findMany>>[number];
type ProductoConFila = ProductoRegional & { fila: FilaProducto };

function aDominio(f: FilaProducto): ProductoConFila {
  return {
    nsuid: f.nsuid,
    titulo: f.titulo,
    editor: f.editor,
    plataforma: f.plataforma as Plataforma,
    tipo: f.tipo as TipoProducto,
    lanzamiento: f.lanzamiento,
    fila: f,
  };
}

interface Grupo {
  a?: FilaProducto;
  e?: FilaProducto;
}

function datosJuego(g: Grupo) {
  // Título en español si existe (catálogo europeo, núcleo ES); si no, el de América.
  const principal = g.e ?? g.a!;
  const otro = g.e && g.a ? g.a : undefined;
  const plataforma = g.a && g.e && g.a.plataforma !== g.e.plataforma ? "AMBAS" : principal.plataforma;
  return {
    titulo: principal.titulo,
    tituloNormalizado: [normalizarTitulo(principal.titulo), otro ? normalizarTitulo(otro.titulo) : ""]
      .filter(Boolean)
      .join(" | "),
    editor: principal.editor ?? otro?.editor ?? null,
    plataforma,
    tipo: principal.tipo,
    lanzamiento: principal.lanzamiento ?? otro?.lanzamiento ?? null,
    imagenUrl: principal.imagenUrl ?? otro?.imagenUrl ?? null,
    descripcion: principal.descripcion ?? otro?.descripcion ?? null,
    popularidad: Math.max(principal.popularidad, otro?.popularidad ?? 0),
  };
}

async function slugLibre(base: string, sufijo: string): Promise<string> {
  const raiz = slugificar(base) || "juego";
  for (const intento of [raiz, `${raiz}-${sufijo}`]) {
    if (!(await db.juego.findUnique({ where: { slug: intento }, select: { id: true } }))) return intento;
  }
  for (let i = 2; ; i++) {
    const s = `${raiz}-${sufijo}-${i}`;
    if (!(await db.juego.findUnique({ where: { slug: s }, select: { id: true } }))) return s;
  }
}

/** Mueve un producto (y los precios de los países de su catálogo) de un juego a otro. */
async function moverProducto(prod: FilaProducto, haciaJuegoId: string) {
  const desde = prod.juegoId;
  const paises = paisesDeCatalogo(prod.catalogo as Catalogo);
  await db.$transaction(async (tx) => {
    if (desde) {
      await tx.precioActual.deleteMany({ where: { juegoId: haciaJuegoId, pais: { in: paises } } });
      await tx.precioHistorico.deleteMany({ where: { juegoId: haciaJuegoId, pais: { in: paises } } });
      await tx.precioActual.updateMany({
        where: { juegoId: desde, pais: { in: paises } },
        data: { juegoId: haciaJuegoId },
      });
      await tx.precioHistorico.updateMany({
        where: { juegoId: desde, pais: { in: paises } },
        data: { juegoId: haciaJuegoId },
      });
    }
    await tx.productoRegional.update({ where: { id: prod.id }, data: { juegoId: haciaJuegoId } });
  });
  prod.juegoId = haciaJuegoId;
}

/**
 * Hace que cada grupo (par matcheado o producto suelto) tenga exactamente un
 * Juego, reutilizando los existentes para no perder historial ni alertas.
 */
async function reconciliar(grupos: Grupo[], ctx: ContextoJob) {
  const juegos = new Map((await db.juego.findMany({ where: { origen: "nintendo" } })).map((j) => [j.id, j]));
  const reclamados = new Set<string>();
  let creados = 0;
  let movidos = 0;
  for (const g of grupos) {
    const candidatos = [g.a?.juegoId, g.e?.juegoId].filter(
      (id): id is string => Boolean(id) && juegos.has(id!) && !reclamados.has(id!),
    );
    const datos = datosJuego(g);
    let juegoId = candidatos[0];
    if (!juegoId) {
      const sufijo = (g.e ?? g.a)!.plataforma === "SWITCH2" ? "switch-2" : (g.e ?? g.a)!.nsuid.slice(-6);
      const creado = await db.juego.create({ data: { ...datos, slug: await slugLibre(datos.titulo, sufijo) } });
      juegos.set(creado.id, creado);
      juegoId = creado.id;
      creados++;
    } else {
      const actual = juegos.get(juegoId)!;
      const cambio = (Object.keys(datos) as (keyof typeof datos)[]).some((k) => {
        const a = actual[k] instanceof Date ? (actual[k] as Date).getTime() : actual[k];
        const b = datos[k] instanceof Date ? (datos[k] as Date).getTime() : datos[k];
        return a !== b;
      });
      if (cambio) await db.juego.update({ where: { id: juegoId }, data: datos });
    }
    reclamados.add(juegoId);
    for (const prod of [g.a, g.e]) {
      if (prod && prod.juegoId !== juegoId) {
        await moverProducto(prod, juegoId);
        movidos++;
      }
    }
    ctx.contar();
  }
  // Juegos que se quedaron sin productos (por ejemplo, tras unir dos) se borran.
  const huerfanos = await db.juego.deleteMany({ where: { origen: "nintendo", productos: { none: {} } } });
  ctx.log(`Juegos creados: ${creados}, productos movidos: ${movidos}, juegos vacíos borrados: ${huerfanos.count}`);
}

/** Vuelve a matchear con lo que hay en la base (también lo usa /admin al cargar un override). */
export async function rematchear(ctx: ContextoJob) {
  const [filasA, filasE, overrides] = await Promise.all([
    db.productoRegional.findMany({ where: { catalogo: "AMERICAS" } }),
    db.productoRegional.findMany({ where: { catalogo: "EUROPA" } }),
    leerOverrides(),
  ]);
  const r = matchearCatalogos(filasA.map(aDominio), filasE.map(aDominio), overrides);
  ctx.log(
    `Matcheo: ${r.pares.length} pares, ${r.sinMatchAmericas.length} solo América, ${r.sinMatchEuropa.length} solo Europa`,
  );

  const enPar = new Set<string>();
  const grupos: Grupo[] = r.pares.map((p) => {
    enPar.add(p.americas.fila.id);
    enPar.add(p.europa.fila.id);
    return { a: p.americas.fila, e: p.europa.fila };
  });
  for (const f of filasA) if (!enPar.has(f.id)) grupos.push({ a: f });
  for (const f of filasE) if (!enPar.has(f.id)) grupos.push({ e: f });
  await reconciliar(grupos, ctx);

  // Registro de productos sin matcheo para revisar en /admin/estado.
  await db.sinMatcheo.deleteMany({});
  const sinMatch = [
    ...r.sinMatchAmericas.map((x) => ({
      catalogo: "AMERICAS",
      nsuid: x.producto.nsuid,
      titulo: x.producto.titulo,
      motivo: x.motivo,
    })),
    ...r.sinMatchEuropa.map((x) => ({
      catalogo: "EUROPA",
      nsuid: x.producto.nsuid,
      titulo: x.producto.titulo,
      motivo: x.motivo,
    })),
  ];
  for (let i = 0; i < sinMatch.length; i += 500) {
    await db.sinMatcheo.createMany({ data: sinMatch.slice(i, i + 500) });
  }
  return `${r.pares.length} pares, ${sinMatch.length} sin matcheo`;
}

export const jobCatalogo: FuncionJob = async (ctx) => {
  const limite = limiteCatalogo();
  const errores: string[] = [];

  if (!fuentes.nintendoAmericas.habilitado()) {
    ctx.log("Catálogo de América deshabilitado (NINTENDO_AMERICAS_HABILITADO=0): no habrá precios de AR ni US");
  } else {
    try {
      const americas = await descargarCatalogoAmericas({ limite });
      ctx.log(`América: ${americas.length} productos`);
      await guardarProductos("AMERICAS", americas, ctx);
      await registrarExito("nintendo-catalogo-americas", `${americas.length} productos`);
    } catch (e) {
      errores.push(`América: ${(e as Error).message}`);
      await registrarError("nintendo-catalogo-americas", e);
    }
  }

  try {
    const europa = await descargarCatalogoEuropa({ limite, alPaginar: (n, t) => ctx.log(`Europa: ${n}/${t}`) });
    for (const pais of paisesEuropa()) {
      try {
        const enlaces = await descargarEnlacesEuropa(pais, limite);
        for (const p of europa) {
          const url = enlaces.get(p.nsuid);
          if (url) p.urls[pais] = url;
        }
      } catch (e) {
        ctx.log(`No se pudieron bajar enlaces de ${pais}: ${(e as Error).message}`);
      }
    }
    ctx.log(`Europa: ${europa.length} productos`);
    await guardarProductos("EUROPA", europa, ctx);
    await registrarExito("nintendo-catalogo-europa", `${europa.length} productos`);
  } catch (e) {
    errores.push(`Europa: ${(e as Error).message}`);
    await registrarError("nintendo-catalogo-europa", e);
  }

  if (errores.length === 2) throw new Error(errores.join(" | "));
  const resultado = await rematchear(ctx);
  return errores.length ? `parcial (${errores.join(" | ")}); ${resultado}` : resultado;
};
