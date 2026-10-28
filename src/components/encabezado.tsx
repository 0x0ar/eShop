import Link from "next/link";
import { Suspense } from "react";
import { Heart, Search } from "lucide-react";
import { Logo } from "./logo";
import { BotonTema } from "./tema";
import { WidgetCotizaciones } from "./widget-cotizaciones";
import { ContadorWishlist } from "./wishlist";

const NAV = [
  { href: "/buscar?oferta=1", texto: "Ofertas" },
  { href: "/cotizaciones", texto: "Cotizaciones" },
  { href: "/como-calculamos", texto: "Cómo calculamos" },
];

export function Encabezado() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Saltar al contenido
      </a>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link href="/" aria-label="PixelPeso, ir al inicio">
          <Logo />
        </Link>
        <nav aria-label="Principal" className="order-3 flex w-full gap-1 overflow-x-auto text-sm font-bold sm:order-none sm:w-auto">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-full px-3 py-1.5 whitespace-nowrap hover:bg-muted">
              {n.texto}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <div className="hidden md:block">
            <Suspense fallback={<span className="text-xs text-muted-foreground">Cargando cotizaciones…</span>}>
              <WidgetCotizaciones />
            </Suspense>
          </div>
          <Link href="/buscar" className="inline-flex size-10 items-center justify-center rounded-full hover:bg-muted" aria-label="Buscar juegos">
            <Search className="size-5" aria-hidden="true" />
          </Link>
          <Link
            href="/wishlist"
            className="relative inline-flex size-10 items-center justify-center rounded-full hover:bg-muted"
            aria-label="Mi wishlist"
          >
            <Heart className="size-5" aria-hidden="true" />
            <ContadorWishlist />
          </Link>
          <BotonTema />
        </div>
      </div>
      <div className="border-t border-border px-4 py-1.5 md:hidden">
        <Suspense fallback={null}>
          <WidgetCotizaciones />
        </Suspense>
      </div>
    </header>
  );
}
