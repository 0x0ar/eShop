import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fuentes } from "@config/fuentes";
import { pedir, pedirPagina } from "@/lib/sources/http";
import { urlPrecios } from "@/lib/sources/nintendo/precios";
import { urlBusquedaEuropa } from "@/lib/sources/nintendo/europa";
import { RUTAS, enlacesFichas, esFichaGiftCard, urlInstantGaming } from "@/lib/sources/instantGaming";

/**
 * Baja respuestas reales de cada fuente y las guarda en tests/fixtures/real/
 * para que los tests de parsers corran contra datos de verdad.
 *
 *   npm run fixtures:capturar
 *
 * Cada fuente es independiente: si una falla se informa y se sigue.
 */

const DIR = path.join(process.cwd(), "tests", "fixtures", "real");
const resumen: Record<string, string> = {};

async function guardar(nombre: string, contenido: string) {
  await writeFile(path.join(DIR, nombre), contenido);
  resumen[nombre] = `ok (${contenido.length} bytes)`;
  console.log(`✔ ${nombre}`);
}

async function intentar(nombre: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e) {
    resumen[nombre] = `ERROR: ${(e as Error).message}`;
    console.log(`✘ ${nombre}: ${(e as Error).message}`);
  }
}

function json(texto: string) {
  return JSON.stringify(JSON.parse(texto), null, 2);
}

async function main() {
  await mkdir(DIR, { recursive: true });
  const nsuidsEuropa: string[] = [];
  const nsuidsAmericas: string[] = [];

  await intentar("europa-catalogo.json", async () => {
    const { cuerpo } = await pedir(urlBusquedaEuropa("es", "GAME", 0, 30));
    await guardar("europa-catalogo.json", json(cuerpo));
    for (const d of JSON.parse(cuerpo).response.docs) if (d.nsuid_txt?.[0]) nsuidsEuropa.push(d.nsuid_txt[0]);
  });
  await intentar("europa-dlc.json", async () => {
    const { cuerpo } = await pedir(urlBusquedaEuropa("es", "DLC", 0, 10));
    await guardar("europa-dlc.json", json(cuerpo));
  });

  await intentar("americas-algolia.json", async () => {
    const cfg = fuentes.nintendoAmericas;
    const url = `https://${cfg.appId().toLowerCase()}-dsn.algolia.net/1/indexes/${cfg.indice()}/query`;
    const { cuerpo } = await pedir(url, {
      metodo: "POST",
      cuerpo: JSON.stringify({
        query: "",
        hitsPerPage: 30,
        filters: "platformCode:NINTENDO_SWITCH_2 OR platformCode:NINTENDO_SWITCH",
      }),
      headers: {
        "Content-Type": "application/json",
        "X-Algolia-Application-Id": cfg.appId(),
        "X-Algolia-API-Key": cfg.apiKey(),
      },
    });
    await guardar("americas-algolia.json", json(cuerpo));
    for (const h of JSON.parse(cuerpo).hits) if (h.nsuid) nsuidsAmericas.push(String(h.nsuid));
  });

  for (const [pais, idioma, ids] of [
    ["AR", "es", nsuidsAmericas],
    ["US", "en", nsuidsAmericas],
    ["ES", "es", nsuidsEuropa],
    ["GB", "en", nsuidsEuropa],
    ["PL", "en", nsuidsEuropa],
  ] as const) {
    await intentar(`precios-${pais}.json`, async () => {
      if (ids.length === 0) throw new Error("sin nsuids (falló la descarga del catálogo)");
      const { cuerpo } = await pedir(urlPrecios(pais, idioma, ids.slice(0, 30)));
      await guardar(`precios-${pais}.json`, json(cuerpo));
    });
  }
  // Verifica el máximo de ids por pedido.
  await intentar("precios-max-ids.txt", async () => {
    const ids = nsuidsEuropa.slice(0, 1);
    if (!ids.length) throw new Error("sin nsuids");
    const muchos = Array.from({ length: 51 }, (_, i) => (BigInt(ids[0]) + BigInt(i)).toString());
    const r = await pedir(urlPrecios("ES", "es", muchos), { aceptar: [400, 413, 414] });
    await guardar("precios-max-ids.txt", `51 ids → HTTP ${r.estado}\n${r.cuerpo.slice(0, 500)}`);
  });

  const dolar = fuentes.dolarApi;
  for (const [nombre, ruta] of [
    ["dolarapi-dolar-oficial.json", dolar.rutas.dolarOficial],
    ["dolarapi-dolar-blue.json", dolar.rutas.dolarBlue],
    ["dolarapi-euro-oficial.json", dolar.rutas.euroOficial],
    ["dolarapi-euro-blue.json", dolar.rutas.euroBlue()],
    ["dolarapi-cotizaciones.json", "/v1/cotizaciones"],
  ] as const) {
    await intentar(nombre, async () => {
      const { estado, cuerpo } = await pedir(dolar.baseUrl() + ruta, { aceptar: [404] });
      await guardar(nombre, estado === 404 ? JSON.stringify({ estado: 404, cuerpo }) : json(cuerpo));
    });
  }
  await intentar("frankfurter.json", async () => {
    const { cuerpo } = await pedir(`${fuentes.frankfurter.baseUrl()}/latest?from=EUR&to=USD,GBP,PLN`);
    await guardar("frankfurter.json", json(cuerpo));
  });

  const ig = fuentes.instantGaming.baseUrl();
  await intentar("instant-gaming-robots.txt", async () => {
    const { cuerpo } = await pedir(`${ig}/robots.txt`);
    await guardar("instant-gaming-robots.txt", cuerpo);
  });
  // Solo rutas que robots.txt permite (pedirPagina lo verifica). Se redactan
  // claves y tokens embebidos en el HTML antes de guardar.
  const redactar = (html: string) =>
    html.replace(/(algolia_(?:key|appid): *')[^']+/g, "$1REDACTADO").replace(/(_TOKEN = ")[^"]+/g, "$1REDACTADO");
  const paginas: [string, string][] = [
    ["instant-gaming-categoria-switch.html", urlInstantGaming(RUTAS.categoriasKeys()[0])],
    ["instant-gaming-tarjetas-regalo.html", urlInstantGaming(RUTAS.giftcards())],
  ];
  for (const [nombre, url] of paginas) {
    await intentar(nombre, async () => {
      const html = await pedirPagina(url, null);
      await guardar(nombre, redactar(html));
      const fichas = enlacesFichas(html);
      const ficha = nombre.includes("tarjetas")
        ? fichas.find(esFichaGiftCard)
        : fichas.find((f) => !esFichaGiftCard(f));
      if (!ficha) throw new Error("sin fichas enlazadas");
      const destino = nombre.includes("tarjetas")
        ? "instant-gaming-producto-giftcard.html"
        : "instant-gaming-producto-key.html";
      await guardar(destino, redactar(await pedirPagina(ficha, null)));
    });
  }

  await writeFile(
    path.join(DIR, "_capturado.json"),
    JSON.stringify({ fecha: new Date().toISOString(), resultados: resumen }, null, 2),
  );
  console.log("\nListo. Ahora corré `npm test` y revisá docs/fuentes.md.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
