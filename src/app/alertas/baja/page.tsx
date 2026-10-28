import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { darDeBaja } from "@/lib/alertas";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Darse de baja", robots: { index: false } };

async function baja(formData: FormData) {
  "use server";
  const alerta = await darDeBaja(String(formData.get("token") ?? ""));
  redirect(`/alertas/baja?ok=${alerta ? "1" : "0"}`);
}

export default function PaginaBaja({ searchParams }: PageProps<"/alertas/baja">) {
  return (
    <div className="mx-auto max-w-lg space-y-4 text-center">
      <h1 className="text-3xl font-extrabold">Darse de baja</h1>
      <Suspense fallback={null}>
        <Contenido searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Contenido({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const p = await searchParams;
  if (p.ok === "1") return <p>Listo, no te vamos a escribir más sobre esta alerta.</p>;
  const token = typeof p.token === "string" ? p.token : "";
  if (p.ok === "0" || !token) return <p>El link no es válido.</p>;
  return (
    <form action={baja} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <p>¿Querés dejar de recibir avisos de esta alerta?</p>
      <Button type="submit" size="lg">
        Sí, darme de baja
      </Button>
    </form>
  );
}
