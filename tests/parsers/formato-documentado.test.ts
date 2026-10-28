import { describe, expect, it } from "vitest";
import { parsearPrecios } from "@/lib/sources/nintendo/precios";
import { parsearDocumentoEuropa } from "@/lib/sources/nintendo/europa";
import { parsearHitAmericas, urlsAmericas } from "@/lib/sources/nintendo/americas";
import { parsearDolarApi, parsearFrankfurter } from "@/lib/sources/cotizaciones";
import { limpiarTituloKey, parsearListado, parsearTituloGiftCard, regionActivacion } from "@/lib/sources/instantGaming";
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
      { moneda: "USD", casa: "blue", nombre: "Blue", compra: 1000, venta: 1020.5, fechaActualizacion: "2026-10-28T12:00:00.000Z" },
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

describe("Instant Gaming (HTML de ejemplo)", () => {
  const html = `
    <div class="item"><a class="cover" href="/es/123-comprar-juego-switch/"><img alt="Juego"></a>
      <span class="title">Juego de Prueba (Switch) - Europe</span><div class="price">39,99 €</div></div>
    <div class="item"><a class="cover" href="/es/456-comprar-otro/"></a>
      <span class="title">Otro</span><div class="price">12,50 €</div><span class="nostock"></span></div>
    <a class="next" href="?page=2">›</a>`;

  it("extrae título, precio, URL y stock", () => {
    const r = parsearListado(html, "https://ig.example");
    expect(r.haySiguiente).toBe(true);
    expect(r.items.map((i) => [i.titulo, i.precio.toFixed(), i.moneda, i.url, i.disponible])).toEqual([
      ["Juego de Prueba (Switch) - Europe", "39.99", "EUR", "https://ig.example/es/123-comprar-juego-switch/", true],
      ["Otro", "12.5", "EUR", "https://ig.example/es/456-comprar-otro/", false],
    ]);
  });

  it("interpreta títulos de gift cards", () => {
    const t = (s: string) => {
      const r = parsearTituloGiftCard(s);
      return r && `${r.valor.toFixed()} ${r.moneda} ${r.region}`;
    };
    expect(t("Nintendo eShop Card 25 EUR")).toBe("25 EUR EU");
    expect(t("Tarjeta Nintendo eShop 50€")).toBe("50 EUR EU");
    expect(t("Nintendo eShop Card £15 UK")).toBe("15 GBP GB");
    expect(t("Nintendo eShop Gift Card $20 USD")).toBe("20 USD US");
    expect(t("Zelda (Switch)")).toBeNull();
  });

  it("detecta región de activación y limpia títulos de keys", () => {
    expect(regionActivacion("Juego (Switch) - Europe")).toBe("EU");
    expect(regionActivacion("Juego Nintendo Switch Key NORTH AMERICA")).toBe("US");
    expect(regionActivacion("Juego")).toBeNull();
    expect(limpiarTituloKey("Hollow Knight (Switch) - Nintendo eShop Key EUROPE")).toBe("hollow knight");
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
