import "dotenv/config";
import { db } from "@/lib/db";
import { diaArgentina } from "@/lib/data/cotizaciones";
import { D } from "@/lib/domain/dinero";
import { normalizarTitulo, slugificar } from "@/lib/domain/texto";

/**
 * Datos de DEMOSTRACIÓN para desarrollo local y el test e2e.
 * Juegos inventados, precios inventados. Todo queda marcado (origen "demo",
 * fuente "demo", proveedor "demo") y el sitio muestra un aviso mientras existan.
 *
 *   npm run db:seed:demo            carga los datos
 *   npm run db:seed:demo -- --borrar  los elimina
 */

if (process.env.NODE_ENV === "production" && process.env.PERMITIR_DEMO !== "1") {
  console.error("No se cargan datos de demo con NODE_ENV=production.");
  process.exit(1);
}

interface JuegoDemo {
  titulo: string;
  plataforma: "SWITCH" | "SWITCH2" | "AMBAS";
  tipo: string;
  editor: string;
  /** Precio base en USD/EUR; cada país varía un poco. */
  base: number;
  descuento?: number;
  popularidad: number;
  key?: { precio: number; region: "EU" | "US" };
}

const JUEGOS: JuegoDemo[] = [
  { titulo: "Aventura del Reino Pixelado", plataforma: "SWITCH", tipo: "JUEGO", editor: "Estudio Demo", base: 59.99, descuento: 30, popularidad: 100, key: { precio: 38.5, region: "EU" } },
  { titulo: "Carreras Turbo Kart Demo", plataforma: "SWITCH2", tipo: "JUEGO", editor: "Estudio Demo", base: 79.99, popularidad: 95 },
  { titulo: "Granja Tranquila", plataforma: "SWITCH", tipo: "JUEGO", editor: "Indie Ficticio", base: 14.99, descuento: 50, popularidad: 90, key: { precio: 9.2, region: "EU" } },
  { titulo: "Caballero de las Cavernas", plataforma: "SWITCH", tipo: "JUEGO", editor: "Indie Ficticio", base: 24.99, popularidad: 85 },
  { titulo: "Fiesta de Minijuegos Deluxe", plataforma: "AMBAS", tipo: "EDICION_ESPECIAL", editor: "Estudio Demo", base: 59.99, descuento: 20, popularidad: 80 },
  { titulo: "Aventura del Reino Pixelado – Pase de Expansión", plataforma: "SWITCH", tipo: "PASE_EXPANSION", editor: "Estudio Demo", base: 29.99, popularidad: 60 },
  { titulo: "Escuadrón Galáctico", plataforma: "SWITCH", tipo: "JUEGO", editor: "Otro Editor Demo", base: 39.99, descuento: 40, popularidad: 75, key: { precio: 21.9, region: "US" } },
  { titulo: "Detective de Bolsillo", plataforma: "SWITCH", tipo: "JUEGO", editor: "Indie Ficticio", base: 19.99, popularidad: 70 },
  { titulo: "Ritmo Salvaje – Switch 2 Edition", plataforma: "SWITCH2", tipo: "SWITCH2_EDITION", editor: "Otro Editor Demo", base: 69.99, descuento: 15, popularidad: 65 },
  { titulo: "Plataformas Infinitas", plataforma: "SWITCH", tipo: "JUEGO", editor: "Indie Ficticio", base: 9.99, popularidad: 55 },
  { titulo: "Liga de Fútbol Arcade", plataforma: "SWITCH", tipo: "JUEGO", editor: "Otro Editor Demo", base: 49.99, descuento: 60, popularidad: 50 },
  { titulo: "Ciudad de Bloques", plataforma: "AMBAS", tipo: "JUEGO", editor: "Estudio Demo", base: 29.99, popularidad: 45 },
];

/** País → [moneda, factor sobre el precio base]. Solo para que haya diferencias. */
const PAISES: Record<string, [string, string]> = {
  AR: ["USD", "1.0"],
  US: ["USD", "1.0"],
  ES: ["EUR", "1.0"],
  DE: ["EUR", "0.97"],
  FR: ["EUR", "1.0"],
  IT: ["EUR", "1.0"],
  PT: ["EUR", "0.95"],
  NL: ["EUR", "1.0"],
  PL: ["PLN", "4.1"],
  GB: ["GBP", "0.82"],
};

const COTIZACIONES: [string, string, string | null][] = [
  ["USD:oficial", "1000", "960"],
  ["USD:blue", "1180", "1160"],
  ["EUR:oficial", "1090", "1040"],
  ["EUR:blue", "1290", "1250"],
  ["FX:USD", "1.08", null],
  ["FX:GBP", "0.84", null],
  ["FX:PLN", "4.30", null],
  ["FX:CHF", "0.95", null],
  ["FX:CAD", "1.50", null],
  ["FX:MXN", "20.1", null],
  ["FX:BRL", "6.0", null],
];

async function borrar() {
  await db.juego.deleteMany({ where: { origen: "demo" } });
  await db.cotizacion.deleteMany({ where: { fuente: "demo" } });
  await db.ofertaGiftCard.deleteMany({ where: { proveedor: { startsWith: "demo" } } });
  console.log("Datos de demostración borrados.");
}

async function cargar() {
  await borrar();
  const ahora = new Date();
  const dias = 60;

  // Cotizaciones: una por día con una suba suave, para que el historial tenga sentido.
  for (let d = dias; d >= 0; d--) {
    const fecha = new Date(ahora.getTime() - d * 86_400_000);
    const factor = new D(1).sub(new D(d).mul("0.002"));
    await db.cotizacion.createMany({
      data: COTIZACIONES.map(([clave, venta, compra]) => ({
        fuente: "demo",
        clave,
        venta: clave.startsWith("FX:") ? venta : new D(venta).mul(factor).toFixed(2),
        compra: compra ? new D(compra).mul(factor).toFixed(2) : null,
        fechaFuente: fecha,
        dia: diaArgentina(fecha),
        registrado: fecha,
      })),
    });
  }

  for (const [i, j] of JUEGOS.entries()) {
    const juego = await db.juego.create({
      data: {
        slug: `demo-${slugificar(j.titulo)}`,
        titulo: j.titulo,
        tituloNormalizado: normalizarTitulo(j.titulo),
        editor: j.editor,
        plataforma: j.plataforma,
        tipo: j.tipo,
        lanzamiento: new Date(Date.UTC(2023 + (i % 3), i % 12, 10)),
        imagenUrl: null,
        descripcion: "Juego ficticio para probar el sitio. No existe.",
        popularidad: j.popularidad,
        origen: "demo",
      },
    });
    for (const [pais, [moneda, factor]] of Object.entries(PAISES)) {
      // Algunos juegos no están en todas las eShops, para ver ese caso.
      if (i % 5 === 4 && pais === "AR") continue;
      const regular = new D(j.base).mul(factor).toDecimalPlaces(2);
      const oferta = j.descuento && pais !== "US" ? regular.mul(new D(100 - j.descuento).div(100)).toDecimalPlaces(2) : null;
      await db.precioActual.create({
        data: {
          juegoId: juego.id,
          pais,
          moneda,
          regular: regular.toFixed(2),
          oferta: oferta?.toFixed(2) ?? null,
          ofertaHasta: oferta ? new Date(ahora.getTime() + 7 * 86_400_000) : null,
          estado: "onsale",
          actualizado: ahora,
        },
      });
      for (let d = dias; d >= 0; d -= 3) {
        const fecha = new Date(ahora.getTime() - d * 86_400_000);
        const enOferta = oferta && d < 10;
        await db.precioHistorico.create({
          data: {
            juegoId: juego.id,
            pais,
            dia: diaArgentina(fecha),
            moneda,
            regular: regular.toFixed(2),
            oferta: enOferta ? oferta!.toFixed(2) : d > 40 && d < 50 ? regular.mul("0.9").toFixed(2) : null,
            registrado: fecha,
          },
        });
      }
    }
    if (j.key) {
      await db.ofertaKey.create({
        data: {
          proveedor: "demo",
          nombreProveedor: "Tienda de keys (demo)",
          juegoId: juego.id,
          titulo: `${j.titulo} (Switch) - Key ${j.key.region === "EU" ? "EUROPE" : "NORTH AMERICA"} (demo)`,
          url: `https://example.com/demo/key/${juego.slug}`,
          precio: j.key.precio.toFixed(2),
          moneda: "EUR",
          regionActivacion: j.key.region,
          actualizado: ahora,
        },
      });
    }
  }

  const gift = (region: string, moneda: string, valor: string, precio: string, marketplace = false) => ({
    proveedor: marketplace ? "demo:marketplace" : "demo:tienda",
    nombreProveedor: marketplace ? "Marketplace (demo)" : "Tienda de gift cards (demo)",
    esMarketplace: marketplace,
    regionTarjeta: region,
    monedaTarjeta: moneda,
    valor,
    precio,
    monedaPrecio: "EUR",
    url: `https://example.com/demo/giftcard/${region}-${valor}`,
    titulo: `Gift card ${valor} ${moneda} (demo)`,
    actualizado: ahora,
  });
  await db.ofertaGiftCard.createMany({
    data: [
      gift("EU", "EUR", "15", "14.60"),
      gift("EU", "EUR", "25", "24.10"),
      gift("EU", "EUR", "50", "47.90"),
      gift("EU", "EUR", "100", "93.50", true),
      gift("GB", "GBP", "15", "17.10"),
      gift("GB", "GBP", "25", "28.40"),
      gift("GB", "GBP", "50", "55.90"),
      gift("US", "USD", "10", "9.40"),
      gift("US", "USD", "20", "18.70"),
      gift("US", "USD", "50", "45.80", true),
    ],
  });
  console.log(`Datos de demostración cargados: ${JUEGOS.length} juegos ficticios. Corré "npm run job -- resumen".`);
}

(process.argv.includes("--borrar") ? borrar() : cargar())
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
