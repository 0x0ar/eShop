import Link from "next/link";
import { Logo } from "./logo";

export function Pie() {
  return (
    <footer className="mt-16 border-t border-border bg-card">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm sm:grid-cols-[2fr_1fr]">
        <div className="space-y-2">
          <Logo className="text-base" />
          <p className="text-muted-foreground">
            PixelPeso no está afiliado a Nintendo ni a las tiendas mencionadas. Los precios son orientativos y pueden
            cambiar: verificalos en la tienda antes de comprar. No vendemos nada.
          </p>
        </div>
        <nav aria-label="Pie de página" className="flex flex-col gap-1.5">
          <Link href="/como-calculamos" className="hover:text-primary">Cómo calculamos</Link>
          <Link href="/cotizaciones" className="hover:text-primary">Cotizaciones</Link>
          <Link href="/legal" className="hover:text-primary">Aviso legal y privacidad</Link>
        </nav>
      </div>
    </footer>
  );
}
