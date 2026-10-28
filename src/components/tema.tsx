"use client";

import { ThemeProvider, useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

export function ProveedorTema({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}

const ORDEN = ["system", "light", "dark"] as const;
const ETIQUETA = { system: "Tema del sistema", light: "Tema claro", dark: "Tema oscuro" };

const suscribir = () => () => {};

/** Botón que alterna sistema → claro → oscuro. */
export function BotonTema() {
  const { theme, setTheme } = useTheme();
  // Evita el desajuste de hidratación: en el servidor no se conoce el tema.
  const montado = useSyncExternalStore(
    suscribir,
    () => true,
    () => false,
  );
  const actual = (montado ? theme : "system") as (typeof ORDEN)[number];
  const siguiente = ORDEN[(ORDEN.indexOf(actual) + 1) % ORDEN.length];
  const Icono = actual === "dark" ? Moon : actual === "light" ? Sun : Monitor;
  return (
    <button
      type="button"
      onClick={() => setTheme(siguiente)}
      className="hover:bg-muted inline-flex size-10 items-center justify-center rounded-full"
      aria-label={`${ETIQUETA[actual]}. Cambiar a ${ETIQUETA[siguiente].toLowerCase()}`}
      title={ETIQUETA[actual]}
    >
      <Icono className="size-5" aria-hidden="true" />
    </button>
  );
}
