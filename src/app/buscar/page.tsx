import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { Buscador } from "@/components/buscador";
import { NOMBRE_PLATAFORMA, NOMBRE_TIPO } from "@/components/etiquetas";
import { GrillaJuegos } from "@/components/tarjeta-juego";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label, Select } from "@/components/ui/input";
import { buscarJuegos, ORDENES, type FiltrosBusqueda, type Orden } from "@/lib/data/juegos";

export const metadata: Metadata = { title: "Buscar juegos" };

type Params = Record<string, string | string[] | undefined>;

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const montoValido = (s: string) => (/^\d{1,12}$/.test(s) ? s : undefined);

function leerFiltros(p: Params): FiltrosBusqueda {
  const orden = uno(p.orden);
  return {
    q: uno(p.q).slice(0, 100),
    plataforma: NOMBRE_PLATAFORMA[uno(p.plataforma)] ? uno(p.plataforma) : undefined,
    tipo: NOMBRE_TIPO[uno(p.tipo)] ? uno(p.tipo) : undefined,
    oferta: uno(p.oferta) === "1",
    min: montoValido(uno(p.min)),
    max: montoValido(uno(p.max)),
    orden: orden in ORDENES ? (orden as Orden) : undefined,
    pagina: Number(uno(p.pagina)) || 1,
  };
}

export default function PaginaBuscar({ searchParams }: PageProps<"/buscar">) {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold">Buscar juegos</h1>
      <Suspense fallback={<p className="text-muted-foreground">Buscando…</p>}>
        <Resultados searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Resultados({ searchParams }: { searchParams: Promise<Params> }) {
  await connection();
  const f = leerFiltros(await searchParams);
  let r: Awaited<ReturnType<typeof buscarJuegos>> | null = null;
  try {
    r = await buscarJuegos(f);
  } catch {
    r = null;
  }

  const enlacePagina = (pagina: number) => {
    const u = new URLSearchParams();
    if (f.q) u.set("q", f.q);
    if (f.plataforma) u.set("plataforma", f.plataforma);
    if (f.tipo) u.set("tipo", f.tipo);
    if (f.oferta) u.set("oferta", "1");
    if (f.min) u.set("min", f.min);
    if (f.max) u.set("max", f.max);
    if (f.orden) u.set("orden", f.orden);
    if (pagina > 1) u.set("pagina", String(pagina));
    return `/buscar?${u.toString()}`;
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <form
        action="/buscar"
        className="border-border bg-card h-fit space-y-4 rounded-lg border p-4"
        aria-label="Filtros de búsqueda"
      >
        <div className="space-y-1.5">
          <Label htmlFor="f-q">Título</Label>
          <Input id="f-q" name="q" type="search" defaultValue={f.q} placeholder="Ej: zelda" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="f-plataforma">Plataforma</Label>
          <Select id="f-plataforma" name="plataforma" defaultValue={f.plataforma ?? ""} className="w-full">
            <option value="">Todas</option>
            <option value="SWITCH">Switch</option>
            <option value="SWITCH2">Switch 2</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="f-tipo">Tipo de producto</Label>
          <Select id="f-tipo" name="tipo" defaultValue={f.tipo ?? ""} className="w-full">
            <option value="">Todos</option>
            {Object.entries(NOMBRE_TIPO).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </Select>
        </div>
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-bold">Precio en ARS (mejor opción, dólar oficial)</legend>
          <div className="flex gap-2">
            <Input
              name="min"
              inputMode="numeric"
              pattern="\d*"
              placeholder="Mín."
              defaultValue={f.min}
              aria-label="Precio mínimo en pesos"
            />
            <Input
              name="max"
              inputMode="numeric"
              pattern="\d*"
              placeholder="Máx."
              defaultValue={f.max}
              aria-label="Precio máximo en pesos"
            />
          </div>
        </fieldset>
        <Checkbox name="oferta" value="1" defaultChecked={f.oferta} label="Solo en oferta" />
        <div className="space-y-1.5">
          <Label htmlFor="f-orden">Ordenar por</Label>
          <Select id="f-orden" name="orden" defaultValue={f.orden ?? ""} className="w-full">
            <option value="">Automático</option>
            {Object.entries(ORDENES).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex gap-2">
          <Button type="submit" className="flex-1">
            Aplicar
          </Button>
          <Button asChild variant="ghost">
            <Link href="/buscar">Limpiar</Link>
          </Button>
        </div>
      </form>

      <section aria-live="polite" className="space-y-4">
        <Buscador valor={f.q} />
        {r == null ? (
          <p className="text-muted-foreground">No pudimos buscar en este momento. Probá de nuevo en un rato.</p>
        ) : r.total === 0 ? (
          <p className="text-muted-foreground">No encontramos juegos{f.q ? ` para “${f.q}”` : ""} con esos filtros.</p>
        ) : (
          <>
            <p className="text-muted-foreground text-sm">
              {r.total.toLocaleString("es-AR")} resultado{r.total === 1 ? "" : "s"}
              {f.q ? ` para “${f.q}”` : ""}
            </p>
            <GrillaJuegos juegos={r.resultados} />
            {r.paginas > 1 && (
              <nav aria-label="Paginación" className="flex items-center justify-center gap-2 pt-4">
                {r.pagina > 1 && (
                  <Button asChild variant="outline" size="sm">
                    <Link href={enlacePagina(r.pagina - 1)} rel="prev">
                      Anterior
                    </Link>
                  </Button>
                )}
                <span className="text-sm">
                  Página {r.pagina} de {r.paginas}
                </span>
                {r.pagina < r.paginas && (
                  <Button asChild variant="outline" size="sm">
                    <Link href={enlacePagina(r.pagina + 1)} rel="next">
                      Siguiente
                    </Link>
                  </Button>
                )}
              </nav>
            )}
          </>
        )}
      </section>
    </div>
  );
}
