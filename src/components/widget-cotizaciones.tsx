import Link from "next/link";
import { connection } from "next/server";
import { cotizacionesVigentes } from "@/lib/data/cotizaciones";
import { formatearArs, haceCuanto } from "@/lib/formato";

/** Widget compacto del header: dólar y euro, oficial y blue (venta). */
export async function WidgetCotizaciones() {
  await connection();
  let detalle: Awaited<ReturnType<typeof cotizacionesVigentes>>["detalle"] = [];
  try {
    detalle = (await cotizacionesVigentes()).detalle;
  } catch {
    // Sin base disponible: el header no se rompe.
  }
  const v = (clave: string) => detalle.find((d) => d.clave === clave);
  const items = [
    ["US$", "USD:oficial", "USD:blue"],
    ["€", "EUR:oficial", "EUR:blue"],
  ] as const;
  const ultima = detalle
    .filter((d) => !d.clave.startsWith("FX:"))
    .map((d) => d.registrado)
    .sort()
    .pop();
  if (!ultima) {
    return (
      <Link href="/cotizaciones" className="text-xs text-muted-foreground hover:text-primary">
        Cotizaciones sin datos
      </Link>
    );
  }
  return (
    <Link
      href="/cotizaciones"
      className="tabular flex items-center gap-3 rounded-full bg-muted px-3 py-1 text-xs hover:ring-2 hover:ring-primary"
      aria-label="Ver panel de cotizaciones"
    >
      {items.map(([simbolo, oficial, blue]) => (
        <span key={simbolo} className="whitespace-nowrap">
          <strong>{simbolo}</strong> {formatearArs(v(oficial)?.venta, 0)}
          <span className="text-muted-foreground"> · blue </span>
          {formatearArs(v(blue)?.venta, 0)}
        </span>
      ))}
      <span className="hidden text-muted-foreground lg:inline">{haceCuanto(ultima)}</span>
    </Link>
  );
}
