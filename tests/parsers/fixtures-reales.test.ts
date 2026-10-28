import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parsearPrecios } from "@/lib/sources/nintendo/precios";
import { parsearPaginaEuropa } from "@/lib/sources/nintendo/europa";
import { parsearPaginaAmericas } from "@/lib/sources/nintendo/americas";
import { parsearDolarApi, parsearFrankfurter } from "@/lib/sources/cotizaciones";
import { parsearListado, parsearTituloGiftCard } from "@/lib/sources/instantGaming";
import { parsearRobots } from "@/lib/sources/robots";

/**
 * Tests contra respuestas REALES guardadas con `npm run fixtures:capturar`.
 * Si la fixture no existe, el test se saltea (y se informa).
 */

const DIR = path.join(__dirname, "..", "fixtures", "real");
const ruta = (n: string) => path.join(DIR, n);
const hay = (n: string) => existsSync(ruta(n));
const leer = (n: string) => readFileSync(ruta(n), "utf8");
const leerJson = (n: string) => JSON.parse(leer(n));

describe("fixtures reales", () => {
  it.skipIf(!hay("europa-catalogo.json"))("parsea el catálogo europeo", () => {
    const r = parsearPaginaEuropa(leerJson("europa-catalogo.json"), "ES");
    expect(r.total).toBeGreaterThan(1000);
    expect(r.productos.length).toBeGreaterThan(0);
    for (const p of r.productos) {
      expect(p.nsuid).toMatch(/^\d{14}$/);
      expect(p.titulo.length).toBeGreaterThan(0);
    }
  });

  it.skipIf(!hay("americas-algolia.json"))("parsea el catálogo de América", () => {
    const r = parsearPaginaAmericas(leerJson("americas-algolia.json"));
    expect(r.productos.length).toBeGreaterThan(0);
    expect(r.productos.some((p) => p.urls.US)).toBe(true);
  });

  for (const pais of ["AR", "US", "ES", "GB", "PL"]) {
    it.skipIf(!hay(`precios-${pais}.json`))(`parsea precios de ${pais}`, () => {
      const { precios, sinPrecio } = parsearPrecios(leerJson(`precios-${pais}.json`));
      expect(precios.length + sinPrecio.length).toBeGreaterThan(0);
      for (const p of precios) {
        expect(p.pais).toBe(pais);
        expect(p.moneda).toMatch(/^[A-Z]{3}$/);
        expect(p.regular.gt(0)).toBe(true);
      }
    });
  }

  it.skipIf(!hay("dolarapi-dolar-oficial.json"))("parsea DolarAPI", () => {
    const c = parsearDolarApi(leerJson("dolarapi-dolar-oficial.json"), "USD:oficial");
    expect(c.venta.gt(0)).toBe(true);
  });

  it.skipIf(!hay("frankfurter.json"))("parsea Frankfurter", () => {
    const c = parsearFrankfurter(leerJson("frankfurter.json"));
    expect(c.find((x) => x.clave === "FX:USD")?.venta.gt(0)).toBe(true);
  });

  it.skipIf(!hay("instant-gaming-robots.txt"))("parsea robots.txt de Instant Gaming", () => {
    expect(parsearRobots(leer("instant-gaming-robots.txt")).grupos.length).toBeGreaterThan(0);
  });

  it.skipIf(!hay("instant-gaming-keys.html"))("parsea el listado de keys de Instant Gaming", () => {
    const { items } = parsearListado(leer("instant-gaming-keys.html"));
    expect(items.length).toBeGreaterThan(0);
  });

  it.skipIf(!hay("instant-gaming-giftcards.html"))("encuentra gift cards en Instant Gaming", () => {
    const { items } = parsearListado(leer("instant-gaming-giftcards.html"));
    expect(items.map((i) => parsearTituloGiftCard(i.titulo)).filter(Boolean).length).toBeGreaterThan(0);
  });
});
