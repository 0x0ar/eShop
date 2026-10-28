import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { correrJob, JOBS } from "@/lib/jobs";

/**
 * Endpoint para Vercel Cron (u otro scheduler externo):
 * GET /api/cron/cotizaciones con "Authorization: Bearer <CRON_SECRET>".
 * Ver vercel.json y README (qué jobs conviene correr acá y cuáles en un worker).
 */
export const maxDuration = 300;

function autorizado(req: Request): boolean {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return false;
  const recibido = Buffer.from(req.headers.get("authorization") ?? "");
  const esperado = Buffer.from(`Bearer ${secreto}`);
  return recibido.length === esperado.length && timingSafeEqual(recibido, esperado);
}

export async function GET(req: Request, { params }: RouteContext<"/api/cron/[job]">) {
  if (!autorizado(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { job } = await params;
  if (!JOBS[job] && job !== "todo") return NextResponse.json({ error: "Job desconocido" }, { status: 404 });
  const resultados = await correrJob(job);
  const ok = resultados.every((r) => r.ok);
  return NextResponse.json({ ok, resultados }, { status: ok ? 200 : 500 });
}
