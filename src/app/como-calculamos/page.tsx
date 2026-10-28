import type { Metadata } from "next";
import Link from "next/link";
import { REGIONES_GIFTCARD } from "@config/giftcards";
import { IMPUESTOS, NOMBRE_METODO } from "@config/impuestos";
import { MONEDA_PUENTE, PUNTA_COTIZACION } from "@config/monedas";
import { EUROPA_PAISES_DEFAULT, nombrePais } from "@config/regiones";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatearPorcentaje } from "@/lib/formato";
import { D } from "@/lib/domain/dinero";

export const metadata: Metadata = { title: "Cómo calculamos" };

function Formula({ children }: { children: React.ReactNode }) {
  return <code className="block rounded-md bg-muted px-3 py-2 font-mono text-sm">{children}</code>;
}

export default function ComoCalculamos() {
  return (
    <div className="max-w-3xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-extrabold">Cómo calculamos</h1>
        <p className="text-muted-foreground">
          Todo el cálculo es abierto. Usamos aritmética decimal exacta y redondeamos recién al mostrar.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Las cuatro fórmulas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>
            <strong>P</strong> es el precio vigente en la moneda de la eShop (el de oferta si hay una activa).{" "}
            <strong>C</strong> es la cotización a pesos de DolarAPI (valor de {PUNTA_COTIZACION}): dólar o euro, oficial o blue.
          </p>
          <div className="space-y-1.5">
            <h3 className="font-bold">{NOMBRE_METODO.tarjeta_ar}</h3>
            <Formula>ARS = convertir(P) × C × (1 + IVA)</Formula>
          </div>
          <div className="space-y-1.5">
            <h3 className="font-bold">{NOMBRE_METODO.tarjeta_exterior}</h3>
            <Formula>ARS = convertir(P) × C</Formula>
          </div>
          <div className="space-y-1.5">
            <h3 className="font-bold">{NOMBRE_METODO.gift_card}</h3>
            <Formula>ARS = Σ precio de cada gift card comprada, convertido a pesos</Formula>
          </div>
          <div className="space-y-1.5">
            <h3 className="font-bold">{NOMBRE_METODO.key_ig}</h3>
            <Formula>ARS = convertir(P_InstantGaming) × C</Formula>
          </div>
          <p>Cada fórmula se calcula dos veces: con la cotización oficial y con la blue.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Impuestos</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <ul className="list-disc space-y-1 pl-5">
            {IMPUESTOS.map((i) => (
              <li key={i.id}>
                {i.nombre}: {formatearPorcentaje(new D(i.tasa).mul(100))}, se aplica a{" "}
                {i.aplicaA.map((m) => NOMBRE_METODO[m].toLowerCase()).join(", ")}.
              </li>
            ))}
          </ul>
          <p className="mt-2 text-muted-foreground">
            Si pagás gift cards o keys con tarjeta argentina, en la práctica también pagás IVA: tenelo en cuenta.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conversión de monedas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Los precios en dólares usan el dólar y los precios en euros usan el euro. Las demás monedas pasan primero a su
            “moneda puente” con el tipo de cambio cruzado de Frankfurter (datos del Banco Central Europeo):
          </p>
          <ul className="list-disc pl-5">
            {Object.entries(MONEDA_PUENTE)
              .filter(([m, p]) => m !== p)
              .map(([m, p]) => (
                <li key={m}>
                  {m} → {p}
                </li>
              ))}
          </ul>
          <p>
            Si DolarAPI no publica el euro blue, lo estimamos como <em>dólar blue × dólares por euro</em> y lo marcamos
            como “derivado”.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Región “Europa”</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          Comparamos estas eShops y mostramos la más barata, indicando el país:{" "}
          {EUROPA_PAISES_DEFAULT.map(nombrePais).join(", ")}. España tiene su propia columna. Si marcás que solo tenés
          cuenta en un país, usamos ese.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gift cards</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Las gift cards vienen en montos fijos. Buscamos la combinación (pueden repetirse) que cubre el precio al menor
            costo total; si hay empate, la que deja menos saldo sobrante y después la de menos tarjetas. Te mostramos qué
            tarjetas comprar, cuánto cuestan en pesos y cuánto saldo te sobra.
          </p>
          <p>
            Asumimos que la eShop no te deja pagar una parte con saldo y el resto con tarjeta, así que las gift cards
            tienen que cubrir el precio completo.
          </p>
          <p>Solo usamos tarjetas de la región y la moneda de la eShop:</p>
          <ul className="list-disc pl-5">
            {Object.values(REGIONES_GIFTCARD).map((r) => (
              <li key={r.codigo}>
                {r.nombre}: sirven en {r.paises.map(nombrePais).join(", ")}.
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>La recomendación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Entre todas las combinaciones que podés usar (según las cuentas y medios de pago que marques), elegimos la más
            barata. El ahorro se compara contra comprar en la eShop argentina con tarjeta argentina, con la misma
            cotización.
          </p>
          <p>
            Cada opción muestra sus requisitos: qué cuenta de Nintendo necesitás, qué tarjeta, en qué región se activa una
            key o si la tienda es un marketplace de terceros.
          </p>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        ¿Querés ver las cotizaciones que estamos usando? <Link href="/cotizaciones" className="font-bold text-primary hover:underline">Panel de cotizaciones</Link>.
      </p>
    </div>
  );
}
