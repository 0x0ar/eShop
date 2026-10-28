import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

/** Formulario GET a /buscar: funciona sin JavaScript. */
export function Buscador({ valor = "", className, grande = false }: { valor?: string; className?: string; grande?: boolean }) {
  return (
    <form action="/buscar" role="search" className={cn("relative", className)}>
      <label htmlFor="q" className="sr-only">
        Buscar un juego
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <input
        id="q"
        name="q"
        type="search"
        defaultValue={valor}
        placeholder="Buscá un juego: zelda, mario kart, hollow knight…"
        autoComplete="off"
        className={cn(
          "w-full rounded-full border-2 border-input bg-card pr-28 pl-12 text-foreground placeholder:text-muted-foreground focus-visible:border-primary",
          grande ? "h-14 text-base" : "h-11 text-sm",
        )}
      />
      <button
        type="submit"
        className="absolute top-1/2 right-1.5 h-[calc(100%-12px)] -translate-y-1/2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground hover:bg-primary-hover"
      >
        Buscar
      </button>
    </form>
  );
}
