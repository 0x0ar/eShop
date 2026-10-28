import Link from "next/link";
import { connection } from "next/server";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { cotizacionesVigentes, type CotizacionGuardada } from "@/lib/data/cotizaciones";
import { formatearArs, formatearFechaHora, formatearNumero, haceCuanto } from "@/lib/formato";

const TARJETAS = [
  { titulo: "Dólar oficial", clave: "USD:oficial" },
  { titulo: "Dólar blue", clave: "USD:blue" },
  { titulo: "Euro oficial", clave: "EUR:oficial" },
  { titulo: "Euro blue", clave: "EUR:blue" },
];

const NOMBRE_FUENTE: Record<string, string> = {
  dolarapi: "DolarAPI",
  frankfurter: "Frankfurter (BCE)",
  derivado: "Derivado",
  demo: "Demo",
};

function Valor({ c }: { c: CotizacionGuardada | undefined }) {
  if (!c) return <p className="text-muted-foreground">Sin datos</p>;
  return (
    <dl className="tabular grid grid-cols-2 gap-2">
      <div>
        <dt className="text-muted-foreground text-xs">Compra</dt>
        <dd className="text-lg font-extrabold">{c.compra ? formatearArs(c.compra) : "—"}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground text-xs">Venta</dt>
        <dd className="text-primary text-lg font-extrabold">{formatearArs(c.venta)}</dd>
      </div>
    </dl>
  );
}

export async function PanelCotizaciones({ compacto = false }: { compacto?: boolean }) {
  await connection();
  let datos: Awaited<ReturnType<typeof cotizacionesVigentes>>;
  let fuentes: Awaited<ReturnType<typeof db.estadoFuente.findMany>> = [];
  try {
    datos = await cotizacionesVigentes();
    fuentes = await db.estadoFuente.findMany({ where: { fuente: { in: ["dolarapi", "frankfurter"] } } });
  } catch {
    return <p className="text-muted-foreground">No pudimos leer las cotizaciones en este momento.</p>;
  }
  const porClave = new Map(datos.detalle.map((d) => [d.clave, d]));
  const cruzadas = datos.detalle.filter((d) => d.clave.startsWith("FX:"));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TARJETAS.map((t) => {
          const c = porClave.get(t.clave);
          return (
            <Card key={t.clave}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  {t.titulo}
                  {c?.fuente === "derivado" && <Badge variant="warning">Derivado</Badge>}
                </CardTitle>
                {c && (
                  <CardDescription>
                    {NOMBRE_FUENTE[c.fuente] ?? c.fuente} · {formatearFechaHora(c.fechaFuente ?? c.registrado)}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <Valor c={c} />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {compacto ? (
        <Link href="/cotizaciones" className="text-primary inline-block text-sm font-bold hover:underline">
          Ver tipos de cambio cruzados y estado de las fuentes
        </Link>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Tipos de cambio cruzados</CardTitle>
              <CardDescription>
                Unidades de cada moneda por 1 euro. Se usan para pasar libras, zlotys, etc. a euro o dólar antes de
                convertir a pesos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {cruzadas.length === 0 ? (
                <p className="text-muted-foreground">Sin datos.</p>
              ) : (
                <table className="tabular w-full text-sm">
                  <caption className="sr-only">Tipos de cambio cruzados con base euro</caption>
                  <thead>
                    <tr className="text-muted-foreground text-left">
                      <th scope="col" className="py-1 font-bold">
                        Par
                      </th>
                      <th scope="col" className="py-1 font-bold">
                        Valor
                      </th>
                      <th scope="col" className="py-1 font-bold">
                        Fecha
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {cruzadas.map((c) => (
                      <tr key={c.clave} className="border-border border-t">
                        <td className="py-1.5 font-bold">{c.clave.slice(3)}/EUR</td>
                        <td className="py-1.5">{formatearNumero(c.venta, 4)}</td>
                        <td className="text-muted-foreground py-1.5">
                          {formatearFechaHora(c.fechaFuente ?? c.registrado)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Estado de las fuentes</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {["dolarapi", "frankfurter"].map((id) => {
                  const f = fuentes.find((x) => x.fuente === id);
                  const conError = f?.ultimoError && (!f.ultimoExito || f.ultimoError > f.ultimoExito);
                  return (
                    <li key={id} className="flex flex-wrap items-center gap-2">
                      <strong>{NOMBRE_FUENTE[id]}</strong>
                      {f?.ultimoExito ? (
                        <span>
                          última actualización {formatearFechaHora(f.ultimoExito)} ({haceCuanto(f.ultimoExito)})
                        </span>
                      ) : (
                        <span className="text-muted-foreground">todavía sin datos</span>
                      )}
                      {conError && (
                        <Badge variant="warning">
                          <AlertTriangle className="size-3" aria-hidden="true" /> falló {haceCuanto(f!.ultimoError!)}:
                          se muestra el último dato conocido
                        </Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
      {datos.faltantes.length > 0 && (
        <p className="text-warning text-sm">
          Faltan cotizaciones ({datos.faltantes.join(", ")}): sin ellas no podemos calcular precios en pesos.
        </p>
      )}
    </div>
  );
}
