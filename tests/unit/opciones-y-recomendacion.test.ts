import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { D } from "@/lib/domain/dinero";
import { calcularOpciones, type OfertaGiftCard, type OfertaKey, type PrecioTienda } from "@/lib/domain/opciones";
import { recomendar, textoRequisito } from "@/lib/domain/recomendacion";
import { PERFIL_COMPLETO, type OpcionDTO } from "@/lib/domain/tipos";
import { cotizacionesDePrueba, FECHA } from "./helpers";

function precio(pais: string, moneda: string, regular: string, oferta?: string): PrecioTienda {
  return {
    pais,
    moneda,
    regular: new D(regular),
    oferta: oferta ? new D(oferta) : null,
    ofertaHasta: null,
    actualizado: FECHA,
    url: null,
  };
}

function gift(
  region: string,
  moneda: string,
  valor: string,
  precioEur: string,
  extra: Partial<OfertaGiftCard> = {},
): OfertaGiftCard {
  return {
    proveedor: "ig",
    nombreProveedor: "Instant Gaming",
    esMarketplace: false,
    regionTarjeta: region,
    monedaTarjeta: moneda,
    valor: new D(valor),
    precio: new D(precioEur),
    monedaPrecio: "EUR",
    url: null,
    disponible: true,
    actualizado: FECHA,
    ...extra,
  };
}

const key: OfertaKey = {
  proveedor: "instant-gaming",
  nombreProveedor: "Instant Gaming",
  esMarketplace: false,
  titulo: "Juego (Switch) - Key EUROPE",
  precio: new D("30"),
  moneda: "EUR",
  regionActivacion: "EU",
  url: "https://example.test/key",
  disponible: true,
  actualizado: FECHA,
};

const buscar = (ops: OpcionDTO[], region: string, metodo: string) =>
  ops.find((o) => o.region === region && o.metodo === metodo)!;

describe("cálculo de opciones", () => {
  const anterior = process.env.EUROPA_PAISES;
  beforeEach(() => {
    process.env.EUROPA_PAISES = "DE,GB,PL";
  });
  afterEach(() => {
    process.env.EUROPA_PAISES = anterior;
  });

  const ops = () =>
    calcularOpciones({
      precios: [
        precio("AR", "USD", "70"),
        precio("US", "USD", "70", "49"),
        precio("ES", "EUR", "70"),
        precio("DE", "EUR", "70"),
        precio("GB", "GBP", "48"), // = 60 EUR
        precio("PL", "PLN", "300"), // = 75 EUR
      ],
      keys: [key],
      giftcards: [gift("EU", "EUR", "50", "45"), gift("EU", "EUR", "25", "23"), gift("GB", "GBP", "50", "52")],
      cotizaciones: cotizacionesDePrueba(),
    });

  it("aplica las fórmulas de tarjeta argentina y del exterior", () => {
    const o = ops();
    // AR: 70 USD × 1000 × 1,21
    expect(buscar(o, "AR", "tarjeta_ar").candidatos.oficial[0].ars).toBe("84700");
    expect(buscar(o, "AR", "tarjeta_exterior").candidatos.oficial[0].ars).toBe("70000");
    // US usa el precio de oferta
    expect(buscar(o, "US", "tarjeta_exterior").candidatos.blue[0]).toMatchObject({ ars: "58800", enOferta: true });
  });

  it("en Europa elige el país más barato y lo informa", () => {
    const celdas = buscar(ops(), "EU", "tarjeta_exterior").candidatos.oficial;
    expect(celdas[0]).toMatchObject({ pais: "GB", ars: "66000" });
    expect(celdas.map((c) => c.pais)).toEqual(["GB", "DE", "PL"]);
  });

  it("calcula gift cards con combinación y saldo sobrante", () => {
    const celda = buscar(ops(), "ES", "gift_card").candidatos.oficial[0];
    // 70 EUR → 50 + 25 = 75 (45 + 23 = 68 EUR × 1100)
    expect(celda.ars).toBe("74800");
    expect(celda.giftcards?.sobrante).toBe("5");
    expect(celda.giftcards?.lineas.map((l) => `${l.cantidad}x${l.valor}`)).toEqual(["1x50", "1x25"]);
  });

  it("no ofrece gift cards donde no hay tarjetas compatibles", () => {
    const o = ops();
    expect(buscar(o, "AR", "gift_card").candidatos.oficial).toEqual([]);
    expect(buscar(o, "AR", "gift_card").motivoNoDisponible).toMatch(/gift cards/);
    // Tarjeta de GBP solo sirve en GB, no en PL
    expect(
      buscar(o, "EU", "gift_card")
        .candidatos.oficial.map((c) => c.pais)
        .sort(),
    ).toEqual(["DE", "GB"]);
  });

  it("ofrece la key en las regiones donde se activa", () => {
    const o = ops();
    expect(buscar(o, "ES", "key_ig").candidatos.oficial[0]).toMatchObject({ ars: "33000" });
    expect(buscar(o, "US", "key_ig").candidatos.oficial).toEqual([]);
  });

  it("explica por qué falta una región sin precio", () => {
    const o = calcularOpciones({ precios: [], keys: [], giftcards: [], cotizaciones: cotizacionesDePrueba() });
    expect(buscar(o, "AR", "tarjeta_ar").motivoNoDisponible).toBe("No lo encontramos en la eShop de Argentina");
    const sinDatos = calcularOpciones({
      precios: [],
      keys: [],
      giftcards: [],
      cotizaciones: cotizacionesDePrueba(),
      regionesSinDatos: ["AR"],
    });
    expect(buscar(sinDatos, "AR", "tarjeta_ar").motivoNoDisponible).toBe(
      "Todavía no tenemos datos de la eShop de Argentina",
    );
  });

  it("recomienda la opción más barata y calcula el ahorro", () => {
    const rec = recomendar(ops(), PERFIL_COMPLETO);
    expect(rec.mejor).toMatchObject({ region: "ES", metodo: "key_ig", tipo: "oficial", ars: "33000" });
    expect(rec.referencia?.ars).toBe("84700");
    expect(rec.ahorroArs).toBe("51700");
  });

  it("filtra según lo que tiene el usuario", () => {
    const soloArgentina = {
      ...PERFIL_COMPLETO,
      cuentas: ["AR"],
      tarjetaExterior: false,
      keys: false,
      giftCards: false,
    };
    const rec = recomendar(ops(), soloArgentina);
    expect(rec.mejor).toMatchObject({ region: "AR", metodo: "tarjeta_ar", ars: "84700" });
    expect(rec.ahorroArs).toBe("0");

    const sinTarjetaExterior = { ...PERFIL_COMPLETO, tarjetaExterior: false, keys: false };
    const rec2 = recomendar(ops(), sinTarjetaExterior);
    expect(rec2.mejor?.metodo).toBe("gift_card");

    // Con cuenta solo en Alemania, Europa se resuelve con DE aunque GB sea más barato.
    const soloAlemania = { ...PERFIL_COMPLETO, cuentas: ["DE"], keys: false, giftCards: false };
    const rec3 = recomendar(ops(), soloAlemania);
    expect(rec3.mejor).toMatchObject({ pais: "DE", metodo: "tarjeta_exterior", ars: "77000" });
  });

  it("genera textos de requisitos", () => {
    expect(textoRequisito({ tipo: "key_region", region: "EU" })).toBe("La key se activa solo en cuentas de Europa");
    expect(textoRequisito({ tipo: "tarjeta_exterior", pais: "US" })).toBe("Requiere tarjeta emitida en Estados Unidos");
    expect(textoRequisito({ tipo: "cuenta", paises: ["ES"] })).toBe("Requiere cuenta de Nintendo de España");
  });
});
