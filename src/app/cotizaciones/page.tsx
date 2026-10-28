import type { Metadata } from "next";
import { Suspense } from "react";
import { PanelCotizaciones } from "@/components/panel-cotizaciones";

export const metadata: Metadata = { title: "Cotizaciones" };

export default function PaginaCotizaciones() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-extrabold">Cotizaciones</h1>
        <p className="text-muted-foreground max-w-3xl">
          Dólar y euro, oficial y blue, de DolarAPI. Para convertir precios usamos el valor de <strong>venta</strong>.
          Las monedas que no son dólar ni euro pasan primero por el tipo de cambio cruzado de Frankfurter.
        </p>
      </header>
      <Suspense fallback={<p className="text-muted-foreground">Cargando cotizaciones…</p>}>
        <PanelCotizaciones />
      </Suspense>
    </div>
  );
}
