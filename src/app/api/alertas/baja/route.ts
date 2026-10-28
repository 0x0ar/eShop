import { NextResponse } from "next/server";
import { darDeBaja } from "@/lib/alertas";

/** Baja one-click (RFC 8058): los clientes de correo hacen POST a esta URL. */
export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const alerta = await darDeBaja(token);
  return NextResponse.json({ ok: Boolean(alerta) }, { status: alerta ? 200 : 404 });
}

/** Si alguien abre el link en el navegador, va a la página de baja. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  return NextResponse.redirect(new URL(`/alertas/baja?token=${encodeURIComponent(url.searchParams.get("token") ?? "")}`, url));
}
