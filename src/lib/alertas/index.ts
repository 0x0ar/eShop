import { randomBytes } from "node:crypto";
import { z } from "zod";
import { NOMBRE_METODO } from "@config/impuestos";
import { NOMBRE_REGION, nombrePais } from "@config/regiones";
import { db } from "@/lib/db";
import { cotizacionesVigentes } from "@/lib/data/cotizaciones";
import { giftCardsVigentes, opcionesDeJuego } from "@/lib/data/comparacion";
import { dec } from "@/lib/domain/dinero";
import { recomendar } from "@/lib/domain/recomendacion";
import { PERFIL_COMPLETO, type CeldaDTO, type PerfilUsuario } from "@/lib/domain/tipos";
import { enviarEmail } from "@/lib/email";
import { formatearArs } from "@/lib/formato";

export const MAX_ALERTAS_POR_EMAIL = 25;
/** No se vuelve a avisar del mismo juego antes de esto, salvo que baje más del 2 %. */
const DIAS_ENTRE_AVISOS = 7;

export function urlSitio(): string {
  return (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** Página de baja (link visible) y endpoint one-click (header List-Unsubscribe, RFC 8058). */
export function urlsBaja(tokenBaja: string) {
  return {
    pagina: `${urlSitio()}/alertas/baja?token=${tokenBaja}`,
    unClick: `${urlSitio()}/api/alertas/baja?token=${tokenBaja}`,
  };
}

const token = () => randomBytes(24).toString("base64url");

const escapar = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const perfilSchema = z.object({
  cuentas: z.array(z.string().max(3)).max(20).nullable(),
  tarjetaArgentina: z.boolean(),
  tarjetaExterior: z.boolean(),
  giftCards: z.boolean(),
  marketplaces: z.boolean(),
  keys: z.boolean(),
});

export const nuevaAlertaSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  juegoId: z.string().min(1).max(40),
  precioObjetivo: z
    .string()
    .trim()
    .regex(/^\d{1,12}([.,]\d{1,2})?$/, "Precio inválido")
    .transform((s) => s.replace(",", ".")),
  tipoCotizacion: z.enum(["oficial", "blue"]),
  perfil: perfilSchema.nullable().optional(),
});

export type NuevaAlerta = z.input<typeof nuevaAlertaSchema>;

function plantilla(titulo: string, cuerpoHtml: string, urlBaja?: string) {
  return `<!doctype html><html lang="es"><body style="font-family:Arial,sans-serif;background:#f6f6f6;padding:24px;color:#1a1a1a">
<div style="max-width:560px;margin:auto;background:#fff;border-radius:16px;padding:24px">
<p style="color:#e60023;font-weight:bold;font-size:18px;margin:0 0 12px">PixelPeso</p>
<h1 style="font-size:20px;margin:0 0 16px">${escapar(titulo)}</h1>
${cuerpoHtml}
<p style="font-size:12px;color:#666;margin-top:24px">PixelPeso no está afiliado a Nintendo ni a las tiendas. Los precios son orientativos: verificalos antes de comprar.</p>
${urlBaja ? `<p style="font-size:12px;color:#666"><a href="${urlBaja}">Darme de baja de esta alerta</a></p>` : ""}
</div></body></html>`;
}

/**
 * Crea (o actualiza) una alerta pendiente y manda el mail de confirmación.
 * Doble opt-in: no se avisa nada hasta que la persona confirma.
 */
export async function crearAlerta(entrada: NuevaAlerta): Promise<{ estado: "pendiente" | "activa" }> {
  const datos = nuevaAlertaSchema.parse(entrada);
  const juego = await db.juego.findUnique({
    where: { id: datos.juegoId },
    select: { id: true, titulo: true, slug: true },
  });
  if (!juego) throw new Error("Juego inexistente");

  const existente = await db.alerta.findFirst({
    where: { email: datos.email, juegoId: juego.id, estado: { in: ["pendiente", "activa"] } },
  });
  if (!existente) {
    const activas = await db.alerta.count({ where: { email: datos.email, estado: { in: ["pendiente", "activa"] } } });
    if (activas >= MAX_ALERTAS_POR_EMAIL) throw new Error(`Máximo ${MAX_ALERTAS_POR_EMAIL} alertas por email`);
  }
  const campos = {
    precioObjetivo: datos.precioObjetivo,
    tipoCotizacion: datos.tipoCotizacion,
    perfil: datos.perfil ?? undefined,
  };
  const alerta = existente
    ? await db.alerta.update({ where: { id: existente.id }, data: campos })
    : await db.alerta.create({
        data: { email: datos.email, juegoId: juego.id, ...campos, tokenConfirmacion: token(), tokenBaja: token() },
      });

  if (alerta.estado === "activa") return { estado: "activa" };

  const urlConfirmar = `${urlSitio()}/alertas/confirmar?token=${alerta.tokenConfirmacion}`;
  const baja = urlsBaja(alerta.tokenBaja);
  const urlBaja = baja.pagina;
  const objetivo = formatearArs(datos.precioObjetivo);
  await enviarEmail({
    para: datos.email,
    asunto: `Confirmá tu alerta para ${juego.titulo}`,
    urlBaja: baja.unClick,
    texto: `Pediste que te avisemos cuando "${juego.titulo}" cueste ${objetivo} o menos (cotización ${datos.tipoCotizacion}).\n\nConfirmá la alerta: ${urlConfirmar}\n\nSi no fuiste vos, ignorá este mail.\nDarte de baja: ${urlBaja}`,
    html: plantilla(
      `Confirmá tu alerta para ${juego.titulo}`,
      `<p>Pediste que te avisemos cuando <strong>${escapar(juego.titulo)}</strong> cueste <strong>${objetivo}</strong> o menos (cotización ${datos.tipoCotizacion}).</p>
<p><a href="${urlConfirmar}" style="display:inline-block;background:#e60023;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:bold">Confirmar alerta</a></p>
<p style="font-size:13px;color:#555">Si no fuiste vos, ignorá este mail: sin confirmación no te vamos a escribir.</p>`,
      urlBaja,
    ),
  });
  return { estado: "pendiente" };
}

export async function confirmarAlerta(tokenConfirmacion: string) {
  if (!tokenConfirmacion || tokenConfirmacion.length > 100) return null;
  const alerta = await db.alerta.findUnique({
    where: { tokenConfirmacion },
    include: { juego: { select: { titulo: true, slug: true } } },
  });
  if (!alerta || alerta.estado === "baja") return null;
  if (alerta.estado === "pendiente") {
    await db.alerta.update({ where: { id: alerta.id }, data: { estado: "activa", confirmada: new Date() } });
  }
  return alerta;
}

export async function darDeBaja(tokenBaja: string) {
  if (!tokenBaja || tokenBaja.length > 100) return null;
  const alerta = await db.alerta.findUnique({
    where: { tokenBaja },
    include: { juego: { select: { titulo: true, slug: true } } },
  });
  if (!alerta) return null;
  if (alerta.estado !== "baja") await db.alerta.update({ where: { id: alerta.id }, data: { estado: "baja" } });
  return alerta;
}

function describir(c: CeldaDTO): string {
  return `${NOMBRE_REGION[c.region]}${c.region === "EU" ? ` (${nombrePais(c.pais)})` : ""} · ${NOMBRE_METODO[c.metodo]}`;
}

/**
 * Revisa las alertas activas: si la opción más barata que la persona puede
 * usar (según su perfil y cotización) está por debajo del objetivo, avisa.
 */
export async function revisarAlertas(log: (m: string) => void = console.log): Promise<number> {
  const { cotizaciones } = await cotizacionesVigentes();
  if (!cotizaciones) {
    log("Sin cotizaciones: no se revisan alertas");
    return 0;
  }
  const alertas = await db.alerta.findMany({ where: { estado: "activa" }, include: { juego: true } });
  const giftcards = await giftCardsVigentes();
  const cachePorJuego = new Map<string, Awaited<ReturnType<typeof opcionesDeJuego>>>();
  let enviados = 0;
  for (const a of alertas) {
    let opciones = cachePorJuego.get(a.juegoId);
    if (!opciones) {
      opciones = await opcionesDeJuego(a.juegoId, cotizaciones, giftcards);
      cachePorJuego.set(a.juegoId, opciones);
    }
    const parsed = perfilSchema.safeParse(a.perfil);
    const perfil: PerfilUsuario = parsed.success ? parsed.data : PERFIL_COMPLETO;
    const tipo = a.tipoCotizacion === "blue" ? "blue" : "oficial";
    const rec = recomendar(opciones, perfil, [tipo]);
    if (!rec.mejor) continue;
    const precio = dec(rec.mejor.ars);
    if (precio.gt(dec(a.precioObjetivo.toString()))) continue;

    const ultimo = a.ultimoPrecioAvisado ? dec(a.ultimoPrecioAvisado.toString()) : null;
    const reciente = a.ultimoAviso && Date.now() - a.ultimoAviso.getTime() < DIAS_ENTRE_AVISOS * 86_400_000;
    const bajoMas = ultimo ? precio.lt(ultimo.mul("0.98")) : true;
    if (reciente && !bajoMas) continue;

    const urlJuego = `${urlSitio()}/juego/${a.juego.slug}`;
    const baja = urlsBaja(a.tokenBaja);
    const urlBaja = baja.pagina;
    const precioTxt = formatearArs(precio);
    try {
      await enviarEmail({
        para: a.email,
        asunto: `${a.juego.titulo} bajó a ${precioTxt}`,
        urlBaja: baja.unClick,
        texto: `${a.juego.titulo} cuesta ${precioTxt} (cotización ${tipo}) con: ${describir(rec.mejor)}.\nTu objetivo era ${formatearArs(a.precioObjetivo.toString())}.\n\nVer comparativa: ${urlJuego}\n\nPrecios orientativos: verificá antes de comprar.\nDarte de baja: ${urlBaja}`,
        html: plantilla(
          `${a.juego.titulo} bajó a ${precioTxt}`,
          `<p>La opción más barata para vos ahora es <strong>${escapar(describir(rec.mejor))}</strong>: <strong>${precioTxt}</strong> (cotización ${tipo}).</p>
<p>Tu objetivo era ${formatearArs(a.precioObjetivo.toString())}.</p>
<p><a href="${urlJuego}" style="display:inline-block;background:#e60023;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:bold">Ver comparativa</a></p>`,
          urlBaja,
        ),
      });
      await db.alerta.update({
        where: { id: a.id },
        data: { ultimoAviso: new Date(), ultimoPrecioAvisado: precio.toFixed() },
      });
      enviados++;
    } catch (e) {
      log(`No se pudo avisar a la alerta ${a.id}: ${(e as Error).message}`);
    }
  }
  log(`${alertas.length} alertas activas, ${enviados} avisos enviados`);
  return enviados;
}
