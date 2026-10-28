import type { Metadata } from "next";
import { Suspense } from "react";
import { VistaWishlist } from "./vista";

export const metadata: Metadata = { title: "Mi wishlist" };

export default function PaginaWishlist() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-extrabold">Mi wishlist</h1>
        <p className="text-muted-foreground">
          Se guarda solo en este navegador (no hace falta cuenta). Podés compartirla con un link.
        </p>
      </header>
      <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
        <VistaWishlist />
      </Suspense>
    </div>
  );
}
