import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { ArrowRight } from "lucide-react";
import { Buscador } from "@/components/buscador";
import { PanelCotizaciones } from "@/components/panel-cotizaciones";
import { GrillaJuegos } from "@/components/tarjeta-juego";
import { ofertasDestacadas, juegosPopulares } from "@/lib/data/juegos";

export default function Inicio() {
  return (
    <div className="space-y-10">
      <section className="rounded-lg bg-primary px-5 py-8 text-primary-foreground sm:px-10 sm:py-12">
        <h1 className="max-w-2xl text-3xl leading-tight font-extrabold sm:text-4xl">
          ¿Dónde te sale más barato ese juego de Switch?
        </h1>
        <p className="mt-3 max-w-2xl text-base opacity-95 sm:text-lg">
          Comparamos la eShop de Argentina, España, Europa y Estados Unidos con tarjeta argentina, tarjeta del
          exterior, gift cards y keys. Todo en pesos, con dólar oficial y blue.
        </p>
        <Buscador className="mt-6 max-w-2xl" grande />
      </section>

      <section aria-labelledby="titulo-ofertas" className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <h2 id="titulo-ofertas" className="text-2xl font-extrabold">
            Ofertas destacadas
          </h2>
          <Link href="/buscar?oferta=1&orden=descuento" className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">
            Ver todas <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        <Suspense fallback={<EsqueletoGrilla />}>
          <Ofertas />
        </Suspense>
      </section>

      <section aria-labelledby="titulo-cotizaciones" className="space-y-4">
        <h2 id="titulo-cotizaciones" className="text-2xl font-extrabold">
          Cotizaciones
        </h2>
        <Suspense fallback={<p className="text-muted-foreground">Cargando cotizaciones…</p>}>
          <PanelCotizaciones compacto />
        </Suspense>
      </section>

      <section aria-labelledby="titulo-populares" className="space-y-4">
        <h2 id="titulo-populares" className="text-2xl font-extrabold">
          Populares
        </h2>
        <Suspense fallback={<EsqueletoGrilla />}>
          <Populares />
        </Suspense>
      </section>
    </div>
  );
}

async function Ofertas() {
  await connection();
  const juegos = await ofertasDestacadas(8).catch(() => null);
  if (juegos == null) return <SinDatos />;
  if (juegos.length === 0) return <p className="text-muted-foreground">No hay ofertas cargadas todavía.</p>;
  return <GrillaJuegos juegos={juegos} />;
}

async function Populares() {
  await connection();
  const juegos = await juegosPopulares(8).catch(() => null);
  if (juegos == null) return <SinDatos />;
  if (juegos.length === 0) return <p className="text-muted-foreground">Todavía no se cargó el catálogo.</p>;
  return <GrillaJuegos juegos={juegos} />;
}

function SinDatos() {
  return <p className="text-muted-foreground">No pudimos leer los datos en este momento. Probá de nuevo en un rato.</p>;
}

function EsqueletoGrilla() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-hidden="true">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="aspect-[3/4] animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  );
}
