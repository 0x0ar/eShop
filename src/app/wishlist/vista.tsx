"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Link2, Save } from "lucide-react";
import { GrillaJuegos } from "@/components/tarjeta-juego";
import { guardarWishlist, useWishlist } from "@/components/wishlist";
import { Button } from "@/components/ui/button";
import type { JuegoResumen } from "@/lib/data/juegos";

export function VistaWishlist() {
  const propia = useWishlist();
  const parametro = useSearchParams().get("juegos");
  const compartida = useMemo(
    () => (parametro ? parametro.split(",").filter(Boolean).slice(0, 200) : null),
    [parametro],
  );
  const slugs = compartida ?? propia;
  const clave = slugs.join(",");
  const [datos, setDatos] = useState<{ clave: string; juegos: JuegoResumen[] } | { clave: string; error: true } | null>(
    null,
  );
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!clave) return;
    let cancelado = false;
    fetch(`/api/juegos?slugs=${encodeURIComponent(clave)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j: { juegos: JuegoResumen[] }) => !cancelado && setDatos({ clave, juegos: j.juegos }))
      .catch(() => !cancelado && setDatos({ clave, error: true }));
    return () => {
      cancelado = true;
    };
  }, [clave]);

  const urlCompartir = () => `${window.location.origin}/wishlist?juegos=${encodeURIComponent(propia.join(","))}`;

  if (slugs.length === 0) {
    return (
      <p className="text-muted-foreground">
        Todavía no agregaste juegos. Tocá el corazón en cualquier juego para seguirlo.{" "}
        <Link href="/buscar" className="text-primary font-bold hover:underline">
          Buscar juegos
        </Link>
      </p>
    );
  }

  const cargado = datos && datos.clave === clave ? datos : null;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {compartida ? (
          <>
            <p className="w-full text-sm font-bold">
              Estás viendo una wishlist compartida ({compartida.length} juegos).
            </p>
            <Button onClick={() => guardarWishlist([...propia, ...compartida])}>
              <Save aria-hidden="true" /> Sumar a mi wishlist
            </Button>
            <Button asChild variant="outline">
              <Link href="/wishlist">Ver la mía</Link>
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(urlCompartir());
                setCopiado(true);
                setTimeout(() => setCopiado(false), 2500);
              } catch {
                window.prompt("Copiá este link:", urlCompartir());
              }
            }}
          >
            <Link2 aria-hidden="true" /> {copiado ? "¡Link copiado!" : "Copiar link para compartir"}
          </Button>
        )}
      </div>
      <div aria-live="polite">
        {!cargado ? (
          <p className="text-muted-foreground">Cargando juegos…</p>
        ) : "error" in cargado ? (
          <p className="text-muted-foreground">No pudimos cargar los juegos. Probá de nuevo en un rato.</p>
        ) : cargado.juegos.length === 0 ? (
          <p className="text-muted-foreground">Los juegos de esta lista ya no están en el catálogo.</p>
        ) : (
          <GrillaJuegos juegos={cargado.juegos} />
        )}
      </div>
    </div>
  );
}
