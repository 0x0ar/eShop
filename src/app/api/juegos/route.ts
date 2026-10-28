import { NextResponse } from "next/server";
import { juegosPorSlugs } from "@/lib/data/juegos";

/** Resumen de juegos por slug (lo usa la wishlist). */
export async function GET(req: Request) {
  const slugs = (new URL(req.url).searchParams.get("slugs") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[a-z0-9-]{1,120}$/.test(s))
    .slice(0, 200);
  try {
    return NextResponse.json({ juegos: await juegosPorSlugs(slugs) });
  } catch (e) {
    console.error("[api/juegos]", e);
    return NextResponse.json({ error: "No pudimos leer los juegos" }, { status: 500 });
  }
}
