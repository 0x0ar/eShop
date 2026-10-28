import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { crearAlerta } from "@/lib/alertas";
import { limitar } from "@/lib/limite";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!limitar(`alertas:${ip}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Demasiados pedidos. Probá más tarde." }, { status: 429 });
  }
  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }
  // Honeypot: si un bot completó el campo oculto, se responde OK sin hacer nada.
  if (cuerpo.sitio) return NextResponse.json({ estado: "pendiente" });
  try {
    const r = await crearAlerta({
      email: String(cuerpo.email ?? ""),
      juegoId: String(cuerpo.juegoId ?? ""),
      precioObjetivo: String(cuerpo.precioObjetivo ?? ""),
      tipoCotizacion: cuerpo.tipoCotizacion === "blue" ? "blue" : "oficial",
      perfil: (cuerpo.perfil ?? null) as never,
    });
    return NextResponse.json(r);
  } catch (e) {
    if (e instanceof ZodError) {
      const campo = e.issues[0]?.path[0];
      const mensaje =
        campo === "email" ? "Revisá el email" : campo === "precioObjetivo" ? "Revisá el precio" : "Datos inválidos";
      return NextResponse.json({ error: mensaje }, { status: 400 });
    }
    const mensaje = (e as Error).message;
    if (/Máximo|inexistente/.test(mensaje)) return NextResponse.json({ error: mensaje }, { status: 400 });
    console.error("[api/alertas]", e);
    return NextResponse.json({ error: "No pudimos crear la alerta. Probá más tarde." }, { status: 500 });
  }
}
