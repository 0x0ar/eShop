"use client";

import { Fragment, useMemo, useState } from "react";
import { ArrowDownUp, Check, ChevronDown, ExternalLink, Info, Trophy } from "lucide-react";
import { NOMBRE_METODO, type MetodoPago } from "@config/impuestos";
import type { TipoCotizacion } from "@config/monedas";
import { NOMBRE_REGION, REGIONES_COMPARACION, nombrePais } from "@config/regiones";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/input";
import { D } from "@/lib/domain/dinero";
import { mejorCeldaViable, recomendar, textoRequisito } from "@/lib/domain/recomendacion";
import type { CeldaDTO, OpcionDTO } from "@/lib/domain/tipos";
import { formatearArs, formatearFechaHora, formatearMoneda, formatearPorcentaje, haceCuanto } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { aPerfilUsuario, PERFIL_UI_COMPLETO, usePerfil, type PerfilUI } from "./perfil";

const METODOS: MetodoPago[] = ["tarjeta_ar", "tarjeta_exterior", "gift_card", "key_ig"];

function nombreOpcion(c: Pick<CeldaDTO, "region" | "pais" | "metodo">) {
  const lugar = c.region === "EU" ? `Europa (${nombrePais(c.pais)})` : NOMBRE_REGION[c.region];
  return `${lugar} · ${NOMBRE_METODO[c.metodo]}`;
}

function enlace(c: CeldaDTO): { url: string; texto: string } | null {
  if (c.key) return { url: c.key.url, texto: `Ver key en ${c.key.nombreProveedor}` };
  if (c.giftcards?.lineas[0]?.url)
    return { url: c.giftcards.lineas[0].url, texto: `Ver gift card en ${c.giftcards.lineas[0].nombreProveedor}` };
  if (c.url) return { url: c.url, texto: `Ir a la eShop de ${nombrePais(c.pais)}` };
  return null;
}

// ─── Filtros de perfil ─────────────────────────────────────────────────

function FiltrosPerfil({ perfil, cambiar }: { perfil: PerfilUI; cambiar: (p: PerfilUI) => void }) {
  const set = (k: keyof PerfilUI) => (e: React.ChangeEvent<HTMLInputElement>) =>
    cambiar({ ...perfil, [k]: e.target.checked });
  const completo = Object.keys(PERFIL_UI_COMPLETO).every((k) => perfil[k as keyof PerfilUI]);
  return (
    <details className="group border-border bg-card rounded-lg border" open={!completo}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4 font-extrabold">
        <span>
          ¿Qué tenés? <span className="text-muted-foreground font-normal">Ajustá la recomendación a tu caso</span>
        </span>
        <ChevronDown className="size-5 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="border-border grid gap-4 border-t p-4 sm:grid-cols-3">
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-bold">Cuentas de Nintendo</legend>
          <Checkbox label="Argentina" checked={perfil.cuentaAR} onChange={set("cuentaAR")} className="flex" />
          <Checkbox label="España" checked={perfil.cuentaES} onChange={set("cuentaES")} className="flex" />
          <Checkbox label="Otro país de Europa" checked={perfil.cuentaEU} onChange={set("cuentaEU")} className="flex" />
          <Checkbox label="Estados Unidos" checked={perfil.cuentaUS} onChange={set("cuentaUS")} className="flex" />
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-bold">Medios de pago</legend>
          <Checkbox
            label="Tarjeta argentina"
            checked={perfil.tarjetaArgentina}
            onChange={set("tarjetaArgentina")}
            className="flex"
          />
          <Checkbox
            label="Tarjeta del exterior"
            checked={perfil.tarjetaExterior}
            onChange={set("tarjetaExterior")}
            className="flex"
          />
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-bold">Acepto comprar</legend>
          <Checkbox label="Gift cards" checked={perfil.giftCards} onChange={set("giftCards")} className="flex" />
          <Checkbox label="Keys" checked={perfil.keys} onChange={set("keys")} className="flex" />
          <Checkbox
            label="En marketplaces de terceros"
            checked={perfil.marketplaces}
            onChange={set("marketplaces")}
            className="flex"
          />
        </fieldset>
        {!completo && (
          <button
            type="button"
            className="text-primary text-left text-sm font-bold hover:underline sm:col-span-3"
            onClick={() => cambiar(PERFIL_UI_COMPLETO)}
          >
            Mostrar todas las opciones
          </button>
        )}
      </div>
    </details>
  );
}

// ─── Recomendación ─────────────────────────────────────────────────────

function Requisitos({ celda }: { celda: CeldaDTO }) {
  return (
    <ul className="space-y-1 text-sm">
      {celda.requisitos.map((r, i) => (
        <li key={i} className="flex gap-2">
          <Check className="text-success mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {textoRequisito(r)}
        </li>
      ))}
    </ul>
  );
}

function TarjetaRecomendacion({
  opciones,
  perfil,
}: {
  opciones: OpcionDTO[];
  perfil: ReturnType<typeof aPerfilUsuario>;
}) {
  const rec = useMemo(() => recomendar(opciones, perfil), [opciones, perfil]);
  if (!rec.mejor) {
    return (
      <Card className="border-warning">
        <CardHeader>
          <CardTitle>No hay opciones para tu perfil</CardTitle>
          <CardDescription>
            Con las cuentas y medios de pago que marcaste no encontramos dónde comprarlo. Probá habilitar más opciones.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  const m = rec.mejor;
  const link = enlace(m);
  const ahorro = rec.ahorroArs ? new D(rec.ahorroArs) : null;
  return (
    <Card className="border-primary border-2" data-testid="recomendacion">
      <CardHeader>
        <p className="text-primary flex items-center gap-2 text-sm font-bold">
          <Trophy className="size-4" aria-hidden="true" /> La opción más barata para vos
        </p>
        <CardTitle className="text-xl">{nombreOpcion(m)}</CardTitle>
        <CardDescription>Con cotización {m.tipo === "oficial" ? "oficial" : "blue"}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="tabular text-primary text-4xl font-extrabold">{formatearArs(m.ars)}</p>
        {ahorro && rec.referencia && ahorro.gt(0) ? (
          <p className="bg-success-soft text-success rounded-md p-3 text-sm font-bold">
            Ahorrás {formatearArs(ahorro)} ({formatearPorcentaje(rec.ahorroPorcentaje!)}) frente a la eShop argentina
            con tarjeta argentina ({formatearArs(rec.referencia.ars)}).
          </p>
        ) : rec.referencia && m.region === "AR" && m.metodo === "tarjeta_ar" ? (
          <p className="text-muted-foreground text-sm">
            Comprar en la eShop argentina con tarjeta argentina es lo más conveniente.
          </p>
        ) : !rec.referencia ? (
          <p className="text-muted-foreground text-sm">
            No tenemos el precio en la eShop argentina, así que no podemos calcular el ahorro.
          </p>
        ) : null}
        <Requisitos celda={m} />
        {link && (
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="bg-primary text-primary-foreground hover:bg-primary-hover inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold"
          >
            {link.texto} <ExternalLink className="size-4" aria-hidden="true" />
          </a>
        )}
        <dl className="border-border grid grid-cols-2 gap-3 border-t pt-3 text-sm">
          {(["oficial", "blue"] as TipoCotizacion[]).map((t) => {
            const c = rec.mejorPorTipo[t];
            return (
              <div key={t}>
                <dt className="text-muted-foreground">Mejor con {t}</dt>
                <dd className="tabular font-bold">{c ? formatearArs(c.ars) : "—"}</dd>
                {c && <dd className="text-muted-foreground text-xs">{nombreOpcion(c)}</dd>}
              </div>
            );
          })}
        </dl>
      </CardContent>
    </Card>
  );
}

// ─── Tabla ─────────────────────────────────────────────────────────────

type Orden = { por: "opcion" | TipoCotizacion; asc: boolean };

function Celda({
  op,
  tipo,
  perfil,
  esMejor,
}: {
  op: OpcionDTO;
  tipo: TipoCotizacion;
  perfil: ReturnType<typeof aPerfilUsuario>;
  esMejor: boolean;
}) {
  const viable = mejorCeldaViable(op, tipo, perfil);
  const c = viable ?? op.candidatos[tipo][0];
  if (!c) return <span className="text-muted-foreground">—</span>;
  return (
    <div className={cn("space-y-0.5", !viable && "opacity-60")}>
      <div className="tabular flex flex-wrap items-center gap-1.5 font-extrabold">
        {formatearArs(c.ars)}
        {esMejor && (
          <Badge variant="success">
            <Trophy className="size-3" aria-hidden="true" /> Más barata
          </Badge>
        )}
      </div>
      <div className="text-muted-foreground text-xs">
        {op.region === "EU" && `${nombrePais(c.pais)} · `}
        {formatearMoneda(c.precio, c.moneda)}
        {c.enOferta && " · en oferta"}
      </div>
      {!viable && <div className="text-warning text-xs font-bold">No disponible con tu perfil</div>}
    </div>
  );
}

function Detalle({ op, perfil }: { op: OpcionDTO; perfil: ReturnType<typeof aPerfilUsuario> }) {
  const c = mejorCeldaViable(op, "oficial", perfil) ?? op.candidatos.oficial[0];
  if (!c) return null;
  const link = enlace(c);
  return (
    <div className="grid gap-4 text-sm md:grid-cols-2">
      <div className="space-y-2">
        <h4 className="font-bold">Requisitos</h4>
        <Requisitos celda={c} />
      </div>
      <div className="space-y-2">
        <h4 className="font-bold">Cómo se calcula (cotización oficial)</h4>
        {c.giftcards ? (
          <>
            <ul className="space-y-1">
              {c.giftcards.lineas.map((l, i) => (
                <li key={i}>
                  {l.cantidad} × gift card de {formatearMoneda(l.valor, l.moneda)} en {l.nombreProveedor}
                  {l.esMarketplace && (
                    <Badge variant="warning" className="ml-1">
                      Marketplace
                    </Badge>
                  )}{" "}
                  a {formatearMoneda(l.precio, l.monedaPrecio)} ={" "}
                  {formatearArs(new D(l.costoArsUnitario).mul(l.cantidad))}
                </li>
              ))}
            </ul>
            <p>
              Cargás {formatearMoneda(c.giftcards.valorTotal, c.giftcards.moneda)} para un juego de{" "}
              {formatearMoneda(c.precio, c.moneda)}.{" "}
              <strong>Te sobran {formatearMoneda(c.giftcards.sobrante, c.giftcards.moneda)} de saldo.</strong>
            </p>
            {new D(c.giftcards.restante).gt(0) && (
              <p>
                El resto ({formatearMoneda(c.giftcards.restante, c.giftcards.moneda)}) se paga con tarjeta:{" "}
                {formatearArs(c.giftcards.costoRestanteArs)}.
              </p>
            )}
          </>
        ) : (
          <p>
            {formatearMoneda(c.precio, c.moneda)}
            {c.moneda !== "ARS" && (
              <>
                {" "}
                × {formatearArs(c.cotizacion)} ({c.monedaPuente === c.moneda ? c.moneda : `vía ${c.monedaPuente}`})
              </>
            )}
            {" = "}
            {formatearArs(c.arsSinImpuestos)}
            {c.impuestos.map((i) => (
              <span key={i.nombre}>
                {" "}
                + {i.nombre} {formatearPorcentaje(new D(i.tasa).mul(100))} ({formatearArs(i.monto)})
              </span>
            ))}
          </p>
        )}
        {c.key && <p>Key: {c.key.titulo}</p>}
        {c.precioRegular && c.enOferta && (
          <p>
            Precio regular: {formatearMoneda(c.precioRegular, c.moneda)}
            {c.ofertaHasta && ` · oferta hasta ${formatearFechaHora(c.ofertaHasta)}`}
          </p>
        )}
        <p className="text-muted-foreground">
          Precio actualizado {formatearFechaHora(c.actualizado)} ({haceCuanto(c.actualizado)})
        </p>
        {link && (
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-primary inline-flex items-center gap-1 font-bold hover:underline"
          >
            {link.texto} <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        )}
      </div>
    </div>
  );
}

function TablaComparativa({ opciones, perfil }: { opciones: OpcionDTO[]; perfil: ReturnType<typeof aPerfilUsuario> }) {
  const [orden, setOrden] = useState<Orden>({ por: "opcion", asc: true });
  const [abierta, setAbierta] = useState<string | null>(null);
  const rec = useMemo(() => recomendar(opciones, perfil), [opciones, perfil]);

  const filas = useMemo(() => {
    const base = [...opciones].sort(
      (a, b) =>
        REGIONES_COMPARACION.indexOf(a.region) - REGIONES_COMPARACION.indexOf(b.region) ||
        METODOS.indexOf(a.metodo) - METODOS.indexOf(b.metodo),
    );
    if (orden.por === "opcion") return orden.asc ? base : base.reverse();
    const tipo = orden.por;
    const valor = (o: OpcionDTO) => {
      const c = mejorCeldaViable(o, tipo, perfil);
      return c ? new D(c.ars) : null;
    };
    return base.sort((a, b) => {
      const va = valor(a);
      const vb = valor(b);
      if (!va && !vb) return 0;
      if (!va) return 1;
      if (!vb) return -1;
      return orden.asc ? va.cmp(vb) : vb.cmp(va);
    });
  }, [opciones, orden, perfil]);

  const encabezado = (por: Orden["por"], texto: string) => {
    const activo = orden.por === por;
    return (
      <th scope="col" aria-sort={activo ? (orden.asc ? "ascending" : "descending") : "none"} className="p-0 text-left">
        <button
          type="button"
          className="hover:text-primary flex w-full items-center gap-1 px-2 py-2.5 font-extrabold sm:px-3"
          onClick={() => setOrden({ por, asc: activo ? !orden.asc : true })}
        >
          {texto}
          <ArrowDownUp
            className={cn("size-3.5", activo ? "text-primary" : "text-muted-foreground")}
            aria-hidden="true"
          />
          <span className="sr-only">, ordenar</span>
        </button>
      </th>
    );
  };

  return (
    <div className="border-border bg-card overflow-x-auto rounded-lg border">
      <table className="w-full text-xs sm:text-sm" data-testid="tabla-comparativa">
        <caption className="sr-only">
          Costo final en pesos por región y método de pago, con cotización oficial y blue. La más barata está resaltada.
        </caption>
        <thead className="bg-muted">
          <tr>
            {encabezado("opcion", "Región y método")}
            {encabezado("oficial", "Con oficial")}
            {encabezado("blue", "Con blue")}
            <th scope="col" className="w-10 px-1">
              <span className="sr-only">Detalle</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {filas.map((op) => {
            const vacia = op.candidatos.oficial.length === 0 && op.candidatos.blue.length === 0;
            const esMejor = (t: TipoCotizacion) => {
              const c = mejorCeldaViable(op, t, perfil);
              return Boolean(c && rec.mejor && c === rec.mejor);
            };
            const destacada = esMejor("oficial") || esMejor("blue");
            return (
              <Fragment key={op.id}>
                <tr className={cn("border-border border-t align-top", destacada && "bg-success-soft")}>
                  <th scope="row" className="px-2 py-2.5 text-left font-bold sm:px-3">
                    <div>{op.region === "EU" ? "Europa" : NOMBRE_REGION[op.region]}</div>
                    <div className="text-muted-foreground text-xs font-normal">{NOMBRE_METODO[op.metodo]}</div>
                  </th>
                  {vacia ? (
                    <td colSpan={2} className="text-muted-foreground px-2 py-2.5 sm:px-3">
                      {op.motivoNoDisponible ?? "Sin datos"}
                    </td>
                  ) : (
                    <>
                      <td className="px-2 py-2.5 sm:px-3">
                        <Celda op={op} tipo="oficial" perfil={perfil} esMejor={esMejor("oficial")} />
                      </td>
                      <td className="px-2 py-2.5 sm:px-3">
                        <Celda op={op} tipo="blue" perfil={perfil} esMejor={esMejor("blue")} />
                      </td>
                    </>
                  )}
                  <td className="px-1 py-2">
                    {!vacia && (
                      <button
                        type="button"
                        className="hover:bg-muted inline-flex size-8 items-center justify-center rounded-full"
                        aria-expanded={abierta === op.id}
                        aria-controls={`detalle-${op.id}`}
                        onClick={() => setAbierta(abierta === op.id ? null : op.id)}
                      >
                        <Info className="size-4" aria-hidden="true" />
                        <span className="sr-only">
                          Ver detalle de {NOMBRE_REGION[op.region]}, {NOMBRE_METODO[op.metodo]}
                        </span>
                      </button>
                    )}
                  </td>
                </tr>
                {abierta === op.id && (
                  <tr id={`detalle-${op.id}`} className="border-border bg-background border-t">
                    <td colSpan={4} className="px-3 py-4">
                      <Detalle op={op} perfil={perfil} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Comparador({ opciones, paisesEuropa }: { opciones: OpcionDTO[]; paisesEuropa: string[] }) {
  const [perfilUI, cambiar] = usePerfil();
  const perfil = useMemo(() => aPerfilUsuario(perfilUI, paisesEuropa), [perfilUI, paisesEuropa]);
  return (
    <div className="space-y-4">
      <FiltrosPerfil perfil={perfilUI} cambiar={cambiar} />
      <TarjetaRecomendacion opciones={opciones} perfil={perfil} />
      <section aria-labelledby="titulo-tabla" className="space-y-2">
        <h2 id="titulo-tabla" className="text-xl font-extrabold">
          Comparativa completa
        </h2>
        <p className="text-muted-foreground text-sm">
          4 regiones × 4 métodos de pago, en pesos. Tocá el ícono de información para ver requisitos y el cálculo.
        </p>
        <TablaComparativa opciones={opciones} perfil={perfil} />
      </section>
    </div>
  );
}
