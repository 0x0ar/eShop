import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AlertTriangle, ExternalLink, TrendingDown } from "lucide-react";
import { paisesEuropa, nombrePais, NOMBRE_REGION } from "@config/regiones";
import { NOMBRE_PLATAFORMA, NOMBRE_TIPO } from "@/components/etiquetas";
import { Comparador } from "@/components/ficha/comparador";
import { FormAlerta } from "@/components/ficha/form-alerta";
import { GraficoHistorial } from "@/components/ficha/historial";
import { Portada } from "@/components/portada";
import { BotonWishlist } from "@/components/wishlist";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { fichaJuego } from "@/lib/data/ficha";
import { D } from "@/lib/domain/dinero";
import { recomendar } from "@/lib/domain/recomendacion";
import { PERFIL_COMPLETO } from "@/lib/domain/tipos";
import { formatearArs, formatearFecha, formatearFechaHora, formatearMoneda, haceCuanto } from "@/lib/formato";

export async function generateMetadata({ params }: PageProps<"/juego/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  await connection();
  const juego = await db.juego.findUnique({ where: { slug }, select: { titulo: true } }).catch(() => null);
  return juego
    ? { title: juego.titulo, description: `¿Dónde conviene comprar ${juego.titulo}? Comparativa en pesos entre eShops y métodos de pago.` }
    : { title: "Juego no encontrado" };
}

export default function PaginaJuego({ params }: PageProps<"/juego/[slug]">) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Cargando comparativa…</p>}>
      <Ficha params={params} />
    </Suspense>
  );
}

async function Ficha({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await connection();
  const ficha = await fichaJuego(slug);
  if (!ficha) notFound();
  const { juego, opciones, precios } = ficha;
  const europa = paisesEuropa();
  const mejor = opciones ? recomendar(opciones, PERFIL_COMPLETO).mejorPorTipo.oficial : null;
  // Sugerencia para la alerta: 10 % menos que la mejor opción actual (redondeado a mil).
  const sugerido = mejor ? new D(mejor.ars).mul("0.9").div(1000).floor().mul(1000).toFixed(0) : null;

  return (
    <article className="space-y-8">
      <nav aria-label="Migas de pan" className="text-sm text-muted-foreground">
        <Link href="/" className="hover:text-primary">Inicio</Link> / <Link href="/buscar" className="hover:text-primary">Juegos</Link> /{" "}
        <span aria-current="page">{juego.titulo}</span>
      </nav>

      <header className="grid gap-5 sm:grid-cols-[180px_1fr]">
        <div className="aspect-square w-40 overflow-hidden rounded-lg bg-muted sm:w-full">
          <Portada src={juego.imagenUrl} alt={`Portada de ${juego.titulo}`} />
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="soft">{NOMBRE_PLATAFORMA[juego.plataforma] ?? juego.plataforma}</Badge>
            <Badge variant="muted">{NOMBRE_TIPO[juego.tipo] ?? juego.tipo}</Badge>
            {juego.origen === "demo" && <Badge variant="warning">Datos de demostración</Badge>}
          </div>
          <h1 className="text-3xl leading-tight font-extrabold">{juego.titulo}</h1>
          <p className="text-sm text-muted-foreground">
            {juego.editor && <>{juego.editor} · </>}
            {juego.lanzamiento ? `Lanzamiento: ${formatearFecha(juego.lanzamiento)}` : "Fecha de lanzamiento sin datos"}
          </p>
          {juego.descripcion && <p className="line-clamp-3 max-w-3xl text-sm">{juego.descripcion}</p>}
          <BotonWishlist slug={juego.slug} titulo={juego.titulo} conTexto />
        </div>
      </header>

      {opciones ? (
        <Comparador opciones={opciones} paisesEuropa={europa} />
      ) : (
        <Card className="border-warning">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-warning" aria-hidden="true" /> No podemos calcular en pesos todavía
            </CardTitle>
            <CardDescription>
              Faltan cotizaciones ({ficha.faltanCotizaciones.join(", ")}). Abajo están los precios en la moneda de cada eShop.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <section aria-labelledby="titulo-precios" className="space-y-3">
        <h2 id="titulo-precios" className="text-xl font-extrabold">
          Precios por eShop
        </h2>
        {precios.length === 0 ? (
          <p className="text-muted-foreground">No tenemos precios de este producto en ninguna eShop configurada.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="tabular w-full min-w-[480px] text-sm">
              <caption className="sr-only">Precio en la moneda de cada eShop, mínimo histórico y fecha de actualización</caption>
              <thead className="bg-muted text-left">
                <tr>
                  <th scope="col" className="px-3 py-2">eShop</th>
                  <th scope="col" className="px-3 py-2">Precio</th>
                  <th scope="col" className="px-3 py-2">Mínimo histórico</th>
                  <th scope="col" className="px-3 py-2">Actualizado</th>
                </tr>
              </thead>
              <tbody>
                {precios.map((p) => (
                  <tr key={p.pais} className="border-t border-border">
                    <th scope="row" className="px-3 py-2 text-left font-bold">
                      {p.url ? (
                        <a href={p.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 hover:text-primary">
                          {nombrePais(p.pais)} <ExternalLink className="size-3.5" aria-hidden="true" />
                          <span className="sr-only">(abre la eShop)</span>
                        </a>
                      ) : (
                        nombrePais(p.pais)
                      )}
                    </th>
                    <td className="px-3 py-2">
                      {p.oferta ? (
                        <>
                          <strong>{formatearMoneda(p.oferta, p.moneda)}</strong>{" "}
                          <s className="text-muted-foreground">{formatearMoneda(p.regular, p.moneda)}</s>
                          {p.ofertaHasta && <div className="text-xs text-muted-foreground">hasta {formatearFechaHora(p.ofertaHasta)}</div>}
                        </>
                      ) : (
                        formatearMoneda(p.regular, p.moneda)
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {p.minimoHistorico ? formatearMoneda(p.minimoHistorico, p.moneda) : "—"}
                      {p.esMinimoHistorico && (
                        <Badge variant="success" className="ml-2">
                          <TrendingDown className="size-3" aria-hidden="true" /> Es el mínimo
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      <time dateTime={p.actualizado} title={formatearFechaHora(p.actualizado)}>
                        {haceCuanto(p.actualizado)}
                      </time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="titulo-historial" className="space-y-3">
        <h2 id="titulo-historial" className="text-xl font-extrabold">
          Historial de precios en pesos
        </h2>
        <p className="text-sm text-muted-foreground">
          Precio de cada región convertido con la cotización de ese día, sin impuestos. En Europa se toma el país más barato.
        </p>
        {(["oficial", "blue"] as const).map((t) => {
          const m = ficha.minimoHistoricoArs[t];
          return m ? (
            <p key={t} className="text-sm">
              Mínimo histórico ({t}): <strong>{formatearArs(m.valor)}</strong> en {NOMBRE_REGION[m.region]} el {formatearFecha(`${m.dia}T12:00:00Z`)}.
            </p>
          ) : null;
        })}
        <Card>
          <CardContent className="pt-5">
            <GraficoHistorial puntos={ficha.historial} />
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="titulo-alerta" className="space-y-3">
        <h2 id="titulo-alerta" className="text-xl font-extrabold">
          Avisame cuando baje
        </h2>
        <Card>
          <CardContent className="pt-5">
            <FormAlerta juegoId={juego.id} paisesEuropa={europa} sugerido={sugerido} />
          </CardContent>
        </Card>
      </section>

      <p className="text-xs text-muted-foreground">
        Precios orientativos. PixelPeso no está afiliado a Nintendo ni a las tiendas: verificá el precio final antes de
        comprar. Cotizaciones usadas:{" "}
        {ficha.cotizaciones
          .filter((c) => !c.clave.startsWith("FX:"))
          .map((c) => `${c.clave.replace(":", " ")} ${formatearArs(c.venta)} (${haceCuanto(c.registrado)})`)
          .join(" · ")}
        .
      </p>
    </article>
  );
}
