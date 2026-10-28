import { describe, expect, it } from "vitest";
import { aArs, convertir, derivarEuroBlue, MonedaNoSoportadaError } from "@/lib/domain/cotizaciones";
import { aCentavos, D, dec, desdeCentavos, parsearPrecio } from "@/lib/domain/dinero";
import { aplicarImpuestos } from "@/lib/domain/impuestos";
import { formatearArs, formatearMoneda, haceCuanto } from "@/lib/formato";
import { cotizacionesDePrueba } from "./helpers";

describe("dinero", () => {
  it("no arrastra errores de float", () => {
    expect(dec(0.1).add(dec(0.2)).toFixed()).toBe("0.3");
    expect(aCentavos(new D("59.99"))).toBe(5999);
    expect(desdeCentavos(5999).toFixed()).toBe("59.99");
  });

  it.each([
    ["59.99", "59.99"],
    ["$59.99", "59.99"],
    ["59,99 €", "59.99"],
    ["1.234,56", "1234.56"],
    ["1,234.56", "1234.56"],
    ["1.234", "1234"],
    ["7", "7"],
    ["12.5", "12.5"],
  ])("parsea %s", (entrada, esperado) => {
    expect(parsearPrecio(entrada)?.toFixed()).toBe(esperado);
  });

  it("devuelve null si no hay número", () => {
    expect(parsearPrecio("Gratis")).toBeNull();
  });
});

describe("conversión de monedas", () => {
  const c = cotizacionesDePrueba();

  it("USD usa el dólar directamente", () => {
    const r = aArs(new D("10"), "USD", "oficial", c);
    expect(r.ars.toFixed()).toBe("10000");
    expect(r.monedaPuente).toBe("USD");
    expect(aArs(new D("10"), "USD", "blue", c).ars.toFixed()).toBe("12000");
  });

  it("EUR usa el euro directamente", () => {
    expect(aArs(new D("10"), "EUR", "oficial", c).ars.toFixed()).toBe("11000");
    expect(aArs(new D("10"), "EUR", "blue", c).ars.toFixed()).toBe("13000");
  });

  it("GBP y PLN pasan por EUR con Frankfurter", () => {
    // 8 GBP = 10 EUR = 11000 ARS
    expect(aArs(new D("8"), "GBP", "oficial", c).ars.toFixed()).toBe("11000");
    // 40 PLN = 10 EUR = 13000 ARS blue
    expect(aArs(new D("40"), "PLN", "blue", c).ars.toFixed()).toBe("13000");
  });

  it("ARS no se convierte", () => {
    expect(aArs(new D("1500"), "ARS", "blue", c).ars.toFixed()).toBe("1500");
  });

  it("convierte entre monedas no-ARS", () => {
    expect(convertir(new D("11"), "USD", "EUR", c).toFixed()).toBe("10");
    expect(convertir(new D("8"), "GBP", "USD", c).toFixed()).toBe("11");
  });

  it("falla con monedas desconocidas", () => {
    expect(() => aArs(new D("1"), "JPY", "oficial", c)).toThrow(MonedaNoSoportadaError);
  });

  it("deriva el euro blue", () => {
    expect(derivarEuroBlue(new D("1200"), new D("1.1")).toFixed()).toBe("1320");
  });
});

describe("IVA", () => {
  it("se aplica solo a tarjeta argentina por defecto", () => {
    const base = new D("10000");
    expect(aplicarImpuestos(base, "tarjeta_ar").total.toFixed()).toBe("12100");
    expect(aplicarImpuestos(base, "tarjeta_exterior").total.toFixed()).toBe("10000");
    expect(aplicarImpuestos(base, "gift_card").total.toFixed()).toBe("10000");
    expect(aplicarImpuestos(base, "key_ig").total.toFixed()).toBe("10000");
  });

  it("respeta una configuración distinta", () => {
    const lista = [
      { id: "iva", nombre: "IVA", tasa: "0.21", aplicaA: ["tarjeta_ar" as const, "gift_card" as const] },
      { id: "otro", nombre: "Otro", tasa: "0.3", aplicaA: ["tarjeta_ar" as const] },
    ];
    const r = aplicarImpuestos(new D("100"), "tarjeta_ar", lista);
    expect(r.total.toFixed()).toBe("151");
    expect(r.impuestos.map((i) => i.monto.toFixed())).toEqual(["21", "30"]);
    expect(aplicarImpuestos(new D("100"), "gift_card", lista).total.toFixed()).toBe("121");
  });
});

describe("formato es-AR", () => {
  it("formatea pesos", () => {
    expect(formatearArs("1234.565")).toBe("$ 1.234,57");
    expect(formatearArs("1234567.8")).toBe("$ 1.234.567,80");
    expect(formatearArs(null)).toBe("—");
  });

  it("formatea otras monedas con código", () => {
    expect(formatearMoneda("59.99", "USD")).toBe("USD 59,99");
  });

  it("calcula hace cuánto", () => {
    const ahora = new Date("2026-01-01T12:00:00Z");
    expect(haceCuanto(new Date("2026-01-01T11:55:00Z"), ahora)).toBe("hace 5 min");
    expect(haceCuanto(new Date("2025-12-30T12:00:00Z"), ahora)).toBe("hace 2 días");
  });
});
