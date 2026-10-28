import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatearArs } from "@/lib/formato";
import type { JuegoResumen } from "@/lib/data/juegos";
import { NOMBRE_PLATAFORMA, NOMBRE_TIPO } from "./etiquetas";
import { Portada } from "./portada";
import { BotonWishlist } from "./wishlist";

export function TarjetaJuego({ juego }: { juego: JuegoResumen }) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-ring hover:shadow-md">
      <div className="relative aspect-square bg-muted">
        <Portada src={juego.imagenUrl} alt="" />
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          {juego.descuentoMax > 0 && <Badge>-{juego.descuentoMax}%</Badge>}
          {juego.plataforma !== "SWITCH" && <Badge variant="outline" className="bg-card">{NOMBRE_PLATAFORMA[juego.plataforma]}</Badge>}
        </div>
        <div className="absolute top-2 right-2 z-10">
          <BotonWishlist slug={juego.slug} titulo={juego.titulo} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 leading-snug font-extrabold">
          <Link href={`/juego/${juego.slug}`} className="after:absolute after:inset-0 focus:outline-none">
            {juego.titulo}
          </Link>
        </h3>
        <p className="text-xs text-muted-foreground">{NOMBRE_TIPO[juego.tipo] ?? juego.tipo}</p>
        <div className="mt-auto pt-2">
          {juego.mejorArsOficial ? (
            <>
              <p className="text-xs text-muted-foreground">Desde</p>
              <p className="tabular text-lg font-extrabold text-primary">{formatearArs(juego.mejorArsOficial, 0)}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Sin precio</p>
          )}
        </div>
      </div>
    </article>
  );
}

export function GrillaJuegos({ juegos }: { juegos: JuegoResumen[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {juegos.map((j) => (
        <li key={j.id}>
          <TarjetaJuego juego={j} />
        </li>
      ))}
    </ul>
  );
}
