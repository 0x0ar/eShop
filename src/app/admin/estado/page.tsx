import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { adminHabilitado, esAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { JOBS } from "@/lib/jobs";
import { formatearFechaHora, haceCuanto } from "@/lib/formato";
import { agregarOverride, borrarOverride, correrDesdePanel, entrar, salir } from "./acciones";

export const metadata: Metadata = { title: "Estado interno", robots: { index: false, follow: false } };

export default function PaginaEstado({ searchParams }: PageProps<"/admin/estado">) {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold">Estado interno</h1>
      <Suspense fallback={<p>Cargando…</p>}>
        <Contenido searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Contenido({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const p = await searchParams;
  if (!adminHabilitado()) {
    return (
      <p>
        El panel está deshabilitado. Definí la variable <code>ADMIN_TOKEN</code> (12 caracteres o más) para usarlo.
      </p>
    );
  }
  if (!(await esAdmin())) {
    return (
      <form action={entrar} className="max-w-sm space-y-3">
        <Label htmlFor="token">Token de administración</Label>
        <Input id="token" name="token" type="password" required autoComplete="current-password" />
        {p.error && (
          <p className="text-primary text-sm font-bold">
            {p.error === "limite" ? "Demasiados intentos." : "Token incorrecto."}
          </p>
        )}
        <Button type="submit">Entrar</Button>
      </form>
    );
  }
  const filtro = typeof p.q === "string" ? p.q.slice(0, 80) : "";
  const catalogo = p.catalogo === "EUROPA" ? "EUROPA" : p.catalogo === "AMERICAS" ? "AMERICAS" : undefined;

  const [fuentes, conteos, ultimasEjecuciones, sinMatch, totalSinMatch, overrides] = await Promise.all([
    db.estadoFuente.findMany({ orderBy: { fuente: "asc" } }),
    Promise.all([
      db.juego.count(),
      db.productoRegional.count(),
      db.precioActual.count(),
      db.ofertaKey.count({ where: { disponible: true } }),
      db.ofertaGiftCard.count({ where: { disponible: true } }),
      db.alerta.count({ where: { estado: "activa" } }),
      db.alerta.count({ where: { estado: "pendiente" } }),
    ]),
    db.ejecucionJob.findMany({ orderBy: { inicio: "desc" }, take: 25 }),
    db.sinMatcheo.findMany({
      where: { ...(catalogo ? { catalogo } : {}), ...(filtro ? { titulo: { contains: filtro } } : {}) },
      orderBy: { titulo: "asc" },
      take: 100,
    }),
    db.sinMatcheo.count({ where: catalogo ? { catalogo } : {} }),
    db.matchOverride.findMany({ orderBy: { creado: "desc" }, take: 100 }),
  ]);
  const [juegos, productos, precios, keys, giftcards, alertasActivas, alertasPendientes] = conteos;

  return (
    <div className="space-y-6">
      <form action={salir}>
        <Button variant="ghost" size="sm" type="submit">
          Salir
        </Button>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Resumen</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="tabular grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {[
              ["Juegos", juegos],
              ["Productos regionales", productos],
              ["Precios actuales", precios],
              ["Keys disponibles", keys],
              ["Gift cards disponibles", giftcards],
              ["Alertas activas", alertasActivas],
              ["Alertas sin confirmar", alertasPendientes],
              ["Sin matcheo", totalSinMatch],
            ].map(([k, v]) => (
              <div key={k as string}>
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-xl font-extrabold">{(v as number).toLocaleString("es-AR")}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fuentes</CardTitle>
          <CardDescription>Si una fuente falla, el sitio muestra el último dato guardado con su fecha.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-muted-foreground text-left">
              <tr>
                <th className="py-1">Fuente</th>
                <th className="py-1">Estado</th>
                <th className="py-1">Último éxito</th>
                <th className="py-1">Último error</th>
              </tr>
            </thead>
            <tbody>
              {fuentes.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-muted-foreground py-2">
                    Todavía no corrió ningún job.
                  </td>
                </tr>
              )}
              {fuentes.map((f) => {
                const ok = f.ultimoExito && (!f.ultimoError || f.ultimoExito > f.ultimoError);
                return (
                  <tr key={f.fuente} className="border-border border-t align-top">
                    <td className="py-2 font-bold">{f.fuente}</td>
                    <td className="py-2">
                      {ok ? <Badge variant="success">OK</Badge> : <Badge variant="warning">Con error</Badge>}
                    </td>
                    <td className="py-2">
                      {f.ultimoExito ? `${formatearFechaHora(f.ultimoExito)} (${haceCuanto(f.ultimoExito)})` : "—"}
                      {f.detalle && <div className="text-muted-foreground text-xs">{f.detalle}</div>}
                    </td>
                    <td className="py-2">
                      {f.ultimoError ? formatearFechaHora(f.ultimoError) : "—"}
                      {f.error && <div className="text-muted-foreground text-xs break-all">{f.error}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Jobs</CardTitle>
          <CardDescription>
            Los jobs largos (catálogo, precios, scrapers) se corren desde el worker o con <code>npm run job</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {["cotizaciones", "resumen", "alertas", "rematchear", "limpieza"].map((j) => (
              <form key={j} action={correrDesdePanel}>
                <input type="hidden" name="job" value={j} />
                <Button type="submit" variant="outline" size="sm" title={JOBS[j].descripcion}>
                  Correr {j}
                </Button>
              </form>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-muted-foreground text-left">
                <tr>
                  <th className="py-1">Job</th>
                  <th className="py-1">Inicio</th>
                  <th className="py-1">Duración</th>
                  <th className="py-1">Estado</th>
                  <th className="py-1">Ítems</th>
                  <th className="py-1">Mensaje</th>
                </tr>
              </thead>
              <tbody>
                {ultimasEjecuciones.map((e) => (
                  <tr key={e.id} className="border-border border-t align-top">
                    <td className="py-1.5 font-bold">{e.job}</td>
                    <td className="py-1.5">{formatearFechaHora(e.inicio)}</td>
                    <td className="py-1.5">
                      {e.fin ? `${Math.round((e.fin.getTime() - e.inicio.getTime()) / 1000)} s` : "—"}
                    </td>
                    <td className="py-1.5">
                      <Badge variant={e.estado === "ok" ? "success" : e.estado === "error" ? "warning" : "muted"}>
                        {e.estado}
                      </Badge>
                    </td>
                    <td className="py-1.5">{e.items}</td>
                    <td className="text-muted-foreground py-1.5 text-xs break-all">{e.mensaje}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Productos sin matcheo ({totalSinMatch.toLocaleString("es-AR")})</CardTitle>
          <CardDescription>
            Productos de un catálogo sin equivalente en el otro. Muchos son exclusivos de una región; los ambiguos o con
            puntaje bajo se corrigen con un override.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="flex flex-wrap items-end gap-2" action="/admin/estado">
            <div className="space-y-1">
              <Label htmlFor="sm-q">Título</Label>
              <Input id="sm-q" name="q" defaultValue={filtro} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sm-cat">Catálogo</Label>
              <select
                id="sm-cat"
                name="catalogo"
                defaultValue={catalogo ?? ""}
                className="border-input bg-card h-10 rounded-full border-2 px-3 text-sm"
              >
                <option value="">Ambos</option>
                <option value="AMERICAS">América</option>
                <option value="EUROPA">Europa</option>
              </select>
            </div>
            <Button type="submit" variant="outline">
              Filtrar
            </Button>
          </form>
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-card text-muted-foreground sticky top-0 text-left">
                <tr>
                  <th className="py-1">Catálogo</th>
                  <th className="py-1">nsuid</th>
                  <th className="py-1">Título</th>
                  <th className="py-1">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {sinMatch.map((s) => (
                  <tr key={s.id} className="border-border border-t align-top">
                    <td className="py-1">{s.catalogo === "AMERICAS" ? "América" : "Europa"}</td>
                    <td className="py-1 font-mono text-xs">{s.nsuid}</td>
                    <td className="py-1">{s.titulo}</td>
                    <td className="text-muted-foreground py-1 text-xs">{s.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Overrides de matcheo</CardTitle>
          <CardDescription>
            Uní un producto de América con uno de Europa, o dejá uno de los dos vacío para forzar “sin match”. Al
            guardar se rehace el matcheo. También se pueden versionar en <code>config/match-overrides.json</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={agregarOverride} className="grid gap-3 sm:grid-cols-4 sm:items-end">
            <div className="space-y-1">
              <Label htmlFor="ov-a">nsuid América</Label>
              <Input id="ov-a" name="nsuidAmericas" inputMode="numeric" pattern="\d{14}" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ov-e">nsuid Europa</Label>
              <Input id="ov-e" name="nsuidEuropa" inputMode="numeric" pattern="\d{14}" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ov-n">Nota</Label>
              <Input id="ov-n" name="nota" maxLength={200} />
            </div>
            <Button type="submit">Guardar</Button>
          </form>
          {p.error === "nsuid" && (
            <p className="text-primary text-sm font-bold">Los nsuid tienen 14 dígitos; completá al menos uno.</p>
          )}
          <ul className="space-y-1 text-sm">
            {overrides.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs">
                  {o.nsuidAmericas ?? "—"} ↔ {o.nsuidEuropa ?? "—"}
                </span>
                {o.nota && <span className="text-muted-foreground">{o.nota}</span>}
                <form action={borrarOverride}>
                  <input type="hidden" name="id" value={o.id} />
                  <Button type="submit" variant="link" size="sm">
                    Borrar
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
