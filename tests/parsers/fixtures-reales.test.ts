import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parsearPrecios } from "@/lib/sources/nintendo/precios";
import { parsearPaginaEuropa } from "@/lib/sources/nintendo/europa";
import { parsearPaginaArgentina } from "@/lib/sources/nintendo/argentina";
import { parsearDolarApi, parsearFrankfurter } from "@/lib/sources/cotizaciones";
import {
  enlacesFichas,
  enlacesGeneros,
  esFichaGiftCard,
  parsearFicha,
  parsearTituloGiftCard,
  plataformaDeTitulo,
} from "@/lib/sources/instantGaming";
import { parsearRobots, permitidoPorRobots } from "@/lib/sources/robots";

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

  it.skipIf(!hay("argentina-algolia.json"))("parsea el catálogo de Argentina", () => {
    const r = parsearPaginaArgentina(leerJson("argentina-algolia.json"));
    expect(r.total).toBeGreaterThan(10_000);
    expect(r.productos.length).toBeGreaterThan(0);
    for (const p of r.productos) {
      expect(p.nsuid).toMatch(/^\d{14}$/);
      expect(p.urls.AR).toMatch(/^https:\/\/www\.nintendo\.com\/es-ar\/store\/products\//);
      expect(p.urls.US).toMatch(/\/us\/store\/products\//);
    }
    expect(r.productos.some((p) => p.plataforma === "SWITCH2")).toBe(true);
    expect(r.productos.some((p) => p.tipo === "SWITCH2_EDITION")).toBe(true);
  });

  it.skipIf(!hay("argentina-algolia-dlc.json"))("clasifica DLC y pases de mejora reales de Argentina", () => {
    const r = parsearPaginaArgentina(leerJson("argentina-algolia-dlc.json"));
    expect(r.productos.length).toBeGreaterThan(0);
    expect(r.productos.every((p) => p.tipo !== "JUEGO")).toBe(true);
  });

  it.skipIf(!hay("precios-AR.json"))("la eShop argentina cobra en pesos", () => {
    const { precios } = parsearPrecios(leerJson("precios-AR.json"));
    expect(precios.length).toBeGreaterThan(0);
    expect(new Set(precios.map((p) => p.moneda))).toEqual(new Set(["ARS"]));
  });

  for (const pais of ["AR", "US", "ES", "GB", "PL"]) {
    it.skipIf(!hay(`precios-${pais}.json`))(`parsea precios de ${pais}`, () => {
      const { precios, sinPrecio } = parsearPrecios(leerJson(`precios-${pais}.json`));
      expect(precios.length + sinPrecio.length).toBeGreaterThan(0);
      for (const p of precios) {
        expect(p.pais).toBe(pais);
        expect(p.moneda).toMatch(/^[A-Z]{3}$/);
        // Hay juegos gratuitos (precio 0) en las respuestas reales.
        expect(p.regular.gte(0)).toBe(true);
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

  it.skipIf(!hay("instant-gaming-robots.txt"))(
    "robots.txt de Instant Gaming: búsqueda prohibida, categorías permitidas",
    () => {
      const reglas = parsearRobots(leer("instant-gaming-robots.txt"));
      expect(permitidoPorRobots(reglas, "PixelPesoBot/1.0", "/es/busquedas/?q=zelda")).toBe(false);
      expect(permitidoPorRobots(reglas, "PixelPesoBot/1.0", "/es/nintendo/switch/")).toBe(true);
      expect(
        permitidoPorRobots(reglas, "PixelPesoBot/1.0", "/es/23251-comprar-sonic-origins-plus-switch-nintendo-eshop/"),
      ).toBe(true);
    },
  );

  it.skipIf(!hay("instant-gaming-categoria-switch.html"))("encuentra fichas en la categoría Switch", () => {
    const fichas = enlacesFichas(leer("instant-gaming-categoria-switch.html"));
    expect(fichas.filter((f) => !esFichaGiftCard(f)).length).toBeGreaterThan(0);
    expect(enlacesGeneros(leer("instant-gaming-categoria-switch.html")).length).toBeGreaterThan(0);
  });

  it.skipIf(!hay("instant-gaming-producto-key.html"))("parsea la ficha de una key", () => {
    const f = parsearFicha(leer("instant-gaming-producto-key.html"));
    expect(f).not.toBeNull();
    expect(f!.esNintendo).toBe(true);
    expect(f!.moneda).toBe("EUR");
    expect(f!.precio.gt(0)).toBe(true);
    expect(f!.paisesTienda.length).toBeGreaterThan(0);
    expect(f!.titulo).toMatch(/Switch/);
    expect(plataformaDeTitulo(f!.titulo)).not.toBeNull();
  });

  it.skipIf(!hay("instant-gaming-producto-giftcard.html"))("parsea la ficha de una gift card y sus variantes", () => {
    const html = leer("instant-gaming-producto-giftcard.html");
    const f = parsearFicha(html);
    expect(f).not.toBeNull();
    const gc = parsearTituloGiftCard(`${f!.titulo} ${f!.tituloCompleto}`);
    expect(gc).not.toBeNull();
    expect(f!.paisesActivacion.length).toBeGreaterThan(0);
    const variantes = enlacesFichas(html).filter(esFichaGiftCard);
    expect(variantes.length).toBeGreaterThan(1);
    // La variante de 25 GBP solo aparece dentro de datos JSON, no en un <a>.
    expect(variantes.some((u) => u.includes("25gbp"))).toBe(true);
    // Solo fichas del idioma de la tienda.
    expect(variantes.every((u) => u.startsWith("https://www.instant-gaming.com/es/"))).toBe(true);
  });
});
