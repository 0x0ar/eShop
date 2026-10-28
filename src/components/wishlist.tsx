"use client";

import { Heart } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

/**
 * Wishlist sin cuentas: lista de slugs en localStorage. Se comparte por URL
 * (/wishlist?juegos=slug1,slug2).
 */
const CLAVE = "pixelpeso:wishlist";
const EVENTO = "pixelpeso:wishlist";
const VACIA: string[] = [];
let cache: { crudo: string | null; lista: string[] } = { crudo: null, lista: VACIA };

function leer(): string[] {
  let crudo: string | null = null;
  try {
    crudo = localStorage.getItem(CLAVE);
  } catch {
    return VACIA;
  }
  if (crudo === cache.crudo) return cache.lista;
  let lista: string[] = VACIA;
  try {
    const parseado = JSON.parse(crudo ?? "[]");
    if (Array.isArray(parseado)) lista = parseado.filter((s): s is string => typeof s === "string");
  } catch {
    lista = VACIA;
  }
  cache = { crudo, lista };
  return lista;
}

export function guardarWishlist(lista: string[]) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(Array.from(new Set(lista))));
  } catch {
    // modo privado o almacenamiento lleno: no se guarda
  }
  window.dispatchEvent(new Event(EVENTO));
}

function suscribir(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENTO, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENTO, cb);
  };
}

export function useWishlist(): string[] {
  return useSyncExternalStore(suscribir, leer, () => VACIA);
}

export function BotonWishlist({
  slug,
  titulo,
  conTexto = false,
  className,
}: {
  slug: string;
  titulo: string;
  conTexto?: boolean;
  className?: string;
}) {
  const lista = useWishlist();
  const esta = lista.includes(slug);
  return (
    <button
      type="button"
      aria-pressed={esta}
      aria-label={esta ? `Quitar ${titulo} de la wishlist` : `Agregar ${titulo} a la wishlist`}
      onClick={(e) => {
        e.preventDefault();
        guardarWishlist(esta ? lista.filter((s) => s !== slug) : [...lista, slug]);
      }}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-bold transition-colors",
        conTexto
          ? "border-border hover:border-primary h-10 border-2 px-4 text-sm"
          : "bg-card/90 hover:text-primary size-9 shadow",
        esta && "text-primary",
        className,
      )}
    >
      <Heart className={cn("size-4", esta && "fill-current")} aria-hidden="true" />
      {conTexto && (esta ? "En tu wishlist" : "Agregar a wishlist")}
    </button>
  );
}

export function ContadorWishlist() {
  const n = useWishlist().length;
  if (n === 0) return null;
  return (
    <span className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 inline-flex min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold">
      {n}
      <span className="sr-only"> juegos</span>
    </span>
  );
}
