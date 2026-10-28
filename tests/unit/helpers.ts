import { D } from "@/lib/domain/dinero";
import type { Cotizaciones } from "@/lib/domain/cotizaciones";

/**
 * Cotizaciones con números redondos para que los resultados esperados se
 * puedan calcular a mano. No son cotizaciones reales.
 */
export function cotizacionesDePrueba(): Cotizaciones {
  return {
    ars: {
      USD: { oficial: new D(1000), blue: new D(1200) },
      EUR: { oficial: new D(1100), blue: new D(1300) },
    },
    // Unidades por 1 EUR.
    cruzadas: { USD: new D("1.1"), GBP: new D("0.8"), PLN: new D("4") },
  };
}

export const FECHA = new Date("2026-01-01T12:00:00Z");
