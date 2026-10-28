"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TipoCotizacion } from "@config/monedas";
import { NOMBRE_REGION, REGIONES_COMPARACION, type RegionComparacion } from "@config/regiones";
import { formatearArs, formatearFecha, formatearFechaCorta } from "@/lib/formato";
import type { PuntoHistorial } from "@/lib/data/ficha";
import { cn } from "@/lib/utils";

/**
 * Colores categóricos por región (paleta validada de la guía de dataviz, slots
 * 1-4 en orden fijo). La región conserva su color aunque falten series.
 */
const COLORES: Record<"light" | "dark", Record<RegionComparacion, string>> = {
  light: { AR: "#2a78d6", ES: "#eb6834", EU: "#1baf7a", US: "#eda100" },
  dark: { AR: "#3987e5", ES: "#d95926", EU: "#199e70", US: "#c98500" },
};

const suscribir = () => () => {};

export function GraficoHistorial({ puntos }: { puntos: PuntoHistorial[] }) {
  const [tipo, setTipo] = useState<TipoCotizacion>("oficial");
  const { resolvedTheme } = useTheme();
  const montado = useSyncExternalStore(suscribir, () => true, () => false);
  const modo = montado && resolvedTheme === "dark" ? "dark" : "light";
  const ejes = modo === "dark" ? { texto: "#b4b6c2", grilla: "#33364a" } : { texto: "#55555f", grilla: "#e4e2dd" };

  const datos = useMemo(
    () =>
      puntos.map((p) => {
        const fila: Record<string, number | string | null> = { dia: p.dia };
        for (const r of REGIONES_COMPARACION) {
          const v = p.valores[`${r}:${tipo}`];
          // Recharts necesita números para graficar; los montos exactos se muestran formateados en tooltip y tabla.
          fila[r] = v != null ? Number(v) : null;
        }
        return fila;
      }),
    [puntos, tipo],
  );
  const regiones = REGIONES_COMPARACION.filter((r) => datos.some((d) => d[r] != null));

  if (puntos.length === 0) {
    return <p className="text-muted-foreground">Todavía no hay historial de precios para este juego.</p>;
  }

  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Cotización del gráfico" className="inline-flex rounded-full bg-muted p-1 text-sm font-bold">
        {(["oficial", "blue"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={tipo === t}
            onClick={() => setTipo(t)}
            className={cn("rounded-full px-4 py-1.5", tipo === t ? "bg-card shadow" : "text-muted-foreground")}
          >
            {t === "oficial" ? "Oficial" : "Blue"}
          </button>
        ))}
      </div>
      <div className="h-72 w-full" role="img" aria-label={`Evolución del precio en pesos por región, cotización ${tipo}. La tabla debajo tiene los mismos datos.`}>
        {montado && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={datos} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid stroke={ejes.grilla} strokeDasharray="0" vertical={false} />
              <XAxis
                dataKey="dia"
                tickFormatter={(d: string) => formatearFechaCorta(`${d}T12:00:00Z`)}
                tick={{ fill: ejes.texto, fontSize: 12 }}
                axisLine={{ stroke: ejes.grilla }}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis
                tickFormatter={(v: number) => formatearArs(v, 0)}
                tick={{ fill: ejes.texto, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={88}
              />
              <Tooltip
                cursor={{ stroke: ejes.texto, strokeWidth: 1 }}
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--foreground)" }}
                labelFormatter={(d) => formatearFecha(`${d}T12:00:00Z`)}
                formatter={(v, nombre) => [formatearArs(Number(v)), NOMBRE_REGION[nombre as RegionComparacion] ?? nombre]}
              />
              <Legend formatter={(r: string) => <span style={{ color: "var(--foreground)" }}>{NOMBRE_REGION[r as RegionComparacion]}</span>} />
              {regiones.map((r) => (
                <Line
                  key={r}
                  type="monotone"
                  dataKey={r}
                  name={r}
                  stroke={COLORES[modo][r]}
                  strokeWidth={2}
                  dot={datos.length === 1 ? { r: 4 } : false}
                  activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2 }}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer font-bold text-primary">Ver los datos como tabla</summary>
        <div className="mt-2 max-h-72 overflow-auto rounded-md border border-border">
          <table className="tabular w-full">
            <caption className="sr-only">Precio en pesos por día y región, cotización {tipo}, sin impuestos</caption>
            <thead className="sticky top-0 bg-muted">
              <tr>
                <th scope="col" className="px-2 py-1 text-left">Día</th>
                {regiones.map((r) => (
                  <th key={r} scope="col" className="px-2 py-1 text-right">
                    {NOMBRE_REGION[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...puntos].reverse().map((p) => (
                <tr key={p.dia} className="border-t border-border">
                  <th scope="row" className="px-2 py-1 text-left font-normal">
                    {formatearFecha(`${p.dia}T12:00:00Z`)}
                  </th>
                  {regiones.map((r) => (
                    <td key={r} className="px-2 py-1 text-right">
                      {formatearArs(p.valores[`${r}:${tipo}`])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
