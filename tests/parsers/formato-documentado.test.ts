import { describe, expect, it } from "vitest";
import { parsearPrecios } from "@/lib/sources/nintendo/precios";
import { parsearDocumentoEuropa } from "@/lib/sources/nintendo/europa";
import { parsearHitAmericas, urlsAmericas } from "@/lib/sources/nintendo/americas";
import { parsearDolarApi, parsearFrankfurter } from "@/lib/sources/cotizaciones";
import {
  enlacesFichas,
  enlacesGeneros,
  esFichaGiftCard,
  etiquetaRegion,
  limpiarTituloKey,
  parsearTituloGiftCard,
  plataformaDeTitulo,
} from "@/lib/sources/instantGaming";
import { parsearRobots, permitidoPorRobots } from "@/lib/sources/robots";
import { tipoDesdeTitulo } from "@/lib/sources/nintendo/catalogo";

/**
 * Tests de contrato con el FORMATO DOCUMENTADO de cada fuente (no son
 * respuestas reales: esas viven en tests/fixtures/real/ y las prueba
 * fixtures-reales.test.ts). Sirven para fijar el comportamiento del parser.
 */

describe("API de precios de Nintendo (formato documentado)", () => {
  it("separa precios, ofertas y productos sin precio", () => {
    const r = parsearPrecios({
      personalized: false,
      country: "US",
      prices: [
        {
          title_id: 70010000000001,
          sales_status: "onsale",
          regular_price: { amount: "$59.99", currency: "USD", raw_value: "59.99" },
          discount_price: {
            amount: "$41.99",
            currency: "USD",
            raw_value: "41.99",
            start_datetime: "2026-10-01T15:00:00Z",
            end_datetime: "2026-10-31T06:59:59Z",
          },
        },
        { title_id: 70010000000002, sales_status: "not_found" },
      ],
    });
    expect(r.precios).toHaveLength(1);
    expect(r.precios[0]).toMatchObject({ nsuid: "70010000000001", moneda: "USD", pais: "US" });
    expect(r.precios[0].regular.toFixed()).toBe("59.99");
    expect(r.precios[0].oferta?.toFixed()).toBe("41.99");
    expect(r.sinPrecio).toEqual([{ nsuid: "70010000000002", estado: "not_found" }]);
  });

  it("rechaza respuestas con otra forma", () => {
    expect(() => parsearPrecios({ error: "x" })).toThrow();
  });
});

describe("catálogos de Nintendo (formato documentado)", () => {
  it("parsea un documento europeo", () => {
    const p = parsearDocumentoEuropa(
      {
        title: "Juego de Prueba™",
        type: "GAME",
        nsuid_txt: ["70010000000003"],
        publisher: "Editor",
        playable_on_txt: ["HAC"],
        dates_released_dts: ["2024-03-01T00:00:00Z"],
        url: "/es-es/Juegos/juego-de-prueba.html",
        image_url_sq_s: "//img.example/x.jpg",
      },
      "ES",
    );
    expect(p).toMatchObject({ nsuid: "70010000000003", plataforma: "SWITCH", tipo: "JUEGO" });
    expect(p?.urls.ES).toBe("https://www.nintendo.com/es-es/Juegos/juego-de-prueba.html");
    expect(p?.imagenUrl).toBe("https://img.example/x.jpg");
  });

  it("parsea un hit de Algolia y arma la URL argentina", () => {
    const p = parsearHitAmericas({
      title: "Juego de Prueba – Nintendo Switch 2 Edition",
      nsuid: "70010000000004",
      url: "/us/store/products/juego-de-prueba-switch-2/",
      platformCode: "NINTENDO_SWITCH_2",
      softwarePublisher: "Editor",
      releaseDate: "2025-06-05T00:00:00.000Z",
    });
    expect(p).toMatchObject({ plataforma: "SWITCH2", tipo: "SWITCH2_EDITION" });
    expect(urlsAmericas("/us/store/products/x/")).toEqual({
      US: "https://www.nintendo.com/us/store/products/x/",
      AR: "https://www.nintendo.com/es-ar/store/products/x/",
    });
  });

  it("detecta tipos de producto por título", () => {
    expect(tipoDesdeTitulo("Juego – Expansion Pass", "DLC")).toBe("PASE_EXPANSION");
    expect(tipoDesdeTitulo("Juego Nintendo Switch 2 Edition Upgrade Pack", "DLC")).toBe("UPGRADE");
    expect(tipoDesdeTitulo("Juego Deluxe Edition", "JUEGO")).toBe("EDICION_ESPECIAL");
  });
});

describe("cotizaciones (formato documentado)", () => {
  it("parsea DolarAPI", () => {
    const c = parsearDolarApi(
      {
        moneda: "USD",
        casa: "blue",
        nombre: "Blue",
        compra: 1000,
        venta: 1020.5,
        fechaActualizacion: "2026-10-28T12:00:00.000Z",
      },
      "USD:blue",
    );
    expect(c.venta.toFixed()).toBe("1020.5");
    expect(c.compra?.toFixed()).toBe("1000");
  });

  it("parsea Frankfurter con base EUR", () => {
    const c = parsearFrankfurter({ amount: 1, base: "EUR", date: "2026-10-27", rates: { USD: 1.08, GBP: 0.85 } });
    expect(c.map((x) => x.clave)).toEqual(["FX:USD", "FX:GBP"]);
    expect(() => parsearFrankfurter({ amount: 1, base: "USD", date: "2026-10-27", rates: {} })).toThrow();
  });
});

describe("Instant Gaming (funciones puras)", () => {
  it("encuentra enlaces a fichas y géneros", () => {
    const html = `
      <a href="/es/123-comprar-juego-switch-nintendo-eshop/">Juego</a>
      <a href="https://www.instant-gaming.com/es/456-descargar-otro-switch-2-nintendo-eshop/?utm=x">Otro</a>
      <a href="/es/10559-comprar-tarjeta-nintendo-eshop-20-20-card-estados-unidos/">Gift</a>
      <a href="/es/busquedas/?q=zelda">Búsqueda</a>
      <a href="/es/nintendo/generos/rpg/">RPG</a>
      <a href="https://otro-sitio.example/es/1-comprar-x/">Afuera</a>`;
    const fichas = enlacesFichas(html, "https://www.instant-gaming.com");
    expect(fichas).toEqual([
      "https://www.instant-gaming.com/es/123-comprar-juego-switch-nintendo-eshop/",
      "https://www.instant-gaming.com/es/456-descargar-otro-switch-2-nintendo-eshop/",
      "https://www.instant-gaming.com/es/10559-comprar-tarjeta-nintendo-eshop-20-20-card-estados-unidos/",
    ]);
    expect(fichas.filter(esFichaGiftCard)).toHaveLength(1);
    expect(enlacesGeneros(html, "https://www.instant-gaming.com")).toEqual([
      "https://www.instant-gaming.com/es/nintendo/generos/rpg/",
    ]);
  });

  it("interpreta títulos de gift cards", () => {
    const t = (s: string) => {
      const r = parsearTituloGiftCard(s);
      return r && `${r.valor.toFixed()} ${r.moneda} ${r.region}`;
    };
    expect(t("Tarjeta Nintendo eShop 20$")).toBe("20 USD US");
    expect(t("Tarjeta Nintendo eShop 25GBP")).toBe("25 GBP GB");
    expect(t("Nintendo eShop Card 25 EUR")).toBe("25 EUR EU");
    expect(t("Tarjeta Nintendo eShop 50€")).toBe("50 EUR EU");
    expect(t("Nintendo eShop Card £15 UK")).toBe("15 GBP GB");
    expect(t("Zelda (Switch)")).toBeNull();
  });

  it("deduce la región a partir de los países de activación", () => {
    expect(etiquetaRegion(["ES", "DE", "FR"])).toBe("EU");
    expect(etiquetaRegion(["US"])).toBe("US");
    expect(etiquetaRegion(["US", "ES"])).toBe("GLOBAL");
    expect(etiquetaRegion(["AR"])).toBe("LATAM");
    expect(etiquetaRegion(["AR", "US"])).toBe("GLOBAL");
    expect(etiquetaRegion([])).toBeNull();
  });

  it("limpia títulos de keys y detecta la plataforma", () => {
    expect(limpiarTituloKey("Sonic Origins Plus - Switch")).toBe("sonic origins plus");
    expect(limpiarTituloKey("Hollow Knight (Switch) - Nintendo eShop Key EUROPE")).toBe("hollow knight");
    expect(plataformaDeTitulo("Palia - Switch 2")).toBe("SWITCH2");
    expect(plataformaDeTitulo("Sonic Origins Plus - Switch")).toBe("SWITCH");
    expect(plataformaDeTitulo("Tarjeta Nintendo eShop 20$")).toBeNull();
  });
});

describe("robots.txt", () => {
  const reglas = parsearRobots(`
User-agent: *
Disallow: /es/compte/
Disallow: /*?currency=
Allow: /es/compte/publico
Crawl-delay: 2

User-agent: MaloBot
Disallow: /
`);

  it("respeta Allow/Disallow con la regla más específica", () => {
    expect(permitidoPorRobots(reglas, "PixelPesoBot/1.0", "/es/busquedas/?q=x")).toBe(true);
    expect(permitidoPorRobots(reglas, "PixelPesoBot/1.0", "/es/compte/datos")).toBe(false);
    expect(permitidoPorRobots(reglas, "PixelPesoBot/1.0", "/es/compte/publico")).toBe(true);
    expect(permitidoPorRobots(reglas, "PixelPesoBot/1.0", "/es/x?currency=USD")).toBe(false);
    expect(permitidoPorRobots(reglas, "MaloBot/2", "/")).toBe(false);
    expect(reglas.crawlDelayMs).toBe(2000);
  });
});
