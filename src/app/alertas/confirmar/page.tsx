import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { confirmarAlerta } from "@/lib/alertas";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Confirmar alerta", robots: { index: false } };

async function confirmar(formData: FormData) {
  "use server";
  const token = String(formData.get("token") ?? "");
  const alerta = await confirmarAlerta(token);
  redirect(
    alerta ? `/alertas/confirmar?ok=1&juego=${encodeURIComponent(alerta.juego.slug)}` : "/alertas/confirmar?ok=0",
  );
}

export default function PaginaConfirmar({ searchParams }: PageProps<"/alertas/confirmar">) {
  return (
    <div className="mx-auto max-w-lg space-y-4 text-center">
      <h1 className="text-3xl font-extrabold">Confirmar alerta</h1>
      <Suspense fallback={null}>
        <Contenido searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Contenido({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const p = await searchParams;
  const token = typeof p.token === "string" ? p.token : "";
  if (p.ok === "1") {
    const juego = typeof p.juego === "string" ? p.juego : "";
    return (
      <>
        <p>¡Listo! Tu alerta está activa. Te vamos a escribir cuando el precio baje del objetivo.</p>
        {juego && (
          <Button asChild>
            <Link href={`/juego/${juego}`}>Volver al juego</Link>
          </Button>
        )}
      </>
    );
  }
  if (p.ok === "0" || !token) {
    return <p>El link no es válido o la alerta ya fue dada de baja.</p>;
  }
  // Se confirma con un botón (POST) para que los antivirus que abren links no activen la alerta solos.
  return (
    <form action={confirmar} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <p>Tocá el botón para empezar a recibir avisos de precio.</p>
      <Button type="submit" size="lg">
        Confirmar alerta
      </Button>
    </form>
  );
}
