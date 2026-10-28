import { describe, expect, it } from "vitest";
import { D } from "@/lib/domain/dinero";
import { optimizarGiftCards, type TarjetaDisponible } from "@/lib/domain/giftcards";

function tarjeta(valor: number, costo: number | string): TarjetaDisponible<null> {
  return { id: `t${valor}`, valorCentavos: valor * 100, costoArs: new D(costo), datos: null };
}

const resumen = (r: ReturnType<typeof optimizarGiftCards> | null) =>
  r && {
    lineas: r.lineas.map((l) => `${l.cantidad}x${l.tarjeta.valorCentavos / 100}`),
    costo: r.costoTotalArs.toFixed(),
    sobrante: r.sobranteCentavos / 100,
  };

describe("combinación óptima de gift cards", () => {
  it("cubre el precio exacto con una tarjeta", () => {
    const r = optimizarGiftCards(5000, [tarjeta(15, 16), tarjeta(25, 26), tarjeta(50, 52)]);
    expect(resumen(r)).toEqual({ lineas: ["1x50"], costo: "52", sobrante: 0 });
  });

  it("elige la combinación más barata aunque deje saldo", () => {
    // Juego de 59,99: 4x15 = 60 (cuesta 64), 50+15 (cuesta 68), 100 (cuesta 63, en oferta)
    const r = optimizarGiftCards(5999, [tarjeta(15, 16), tarjeta(25, 26), tarjeta(50, 52), tarjeta(100, 63)]);
    expect(resumen(r)).toEqual({ lineas: ["1x100"], costo: "63", sobrante: 40.01 });
  });

  it("desempata por menos saldo sobrante y menos tarjetas", () => {
    // 30 se puede con 2x15 (costo 30, sobrante 0) o 1x50 (costo 30, sobrante 20)
    const r = optimizarGiftCards(3000, [tarjeta(15, 15), tarjeta(50, 30)]);
    expect(resumen(r)).toEqual({ lineas: ["2x15"], costo: "30", sobrante: 0 });
  });

  it("encuentra combinaciones que un algoritmo goloso no ve", () => {
    // Precio 30, tarjetas 25 y 15: goloso tomaría 25+15 (40), lo óptimo es 15+15.
    const r = optimizarGiftCards(3000, [tarjeta(15, 15), tarjeta(25, 25)]);
    expect(resumen(r)).toEqual({ lineas: ["2x15"], costo: "30", sobrante: 0 });
  });

  it("usa la tarjeta más barata cuando hay dos del mismo valor", () => {
    const r = optimizarGiftCards(2000, [
      { ...tarjeta(20, 25), id: "cara" },
      { ...tarjeta(20, 21), id: "barata" },
    ]);
    expect(r?.lineas[0].tarjeta.id).toBe("barata");
  });

  it("devuelve null si no hay tarjetas", () => {
    expect(optimizarGiftCards(1000, [])).toBeNull();
  });

  it("con pago mixto puede no cubrir todo y pagar la diferencia", () => {
    // Juego de 55, tarjetas de 50 a 50 ARS; el centavo restante cuesta 0.02 ARS.
    // 50 + 5 con tarjeta = 50 + 500*0.02 = 60 < 2x50 = 100
    const r = optimizarGiftCards(5500, [tarjeta(50, 50)], { costoPorCentavoRestante: new D("0.02") });
    expect(r?.restanteCentavos).toBe(500);
    expect(r?.costoTotalArs.toFixed()).toBe("60");
    expect(r?.sobranteCentavos).toBe(0);
  });

  it("sin pago mixto nunca deja precio sin cubrir", () => {
    const r = optimizarGiftCards(5500, [tarjeta(50, 50)]);
    expect(r?.valorTotalCentavos).toBe(10000);
    expect(r?.restanteCentavos).toBe(0);
  });

  it("precio cero no requiere tarjetas", () => {
    const r = optimizarGiftCards(0, [tarjeta(10, 10)]);
    expect(r?.lineas).toEqual([]);
    expect(r?.costoTotalArs.toFixed()).toBe("0");
  });

  it("maneja denominaciones con centavos", () => {
    // 9,99 + 4,99 = 14,98 para un juego de 14,50
    const r = optimizarGiftCards(1450, [
      { id: "a", valorCentavos: 999, costoArs: new D(10), datos: null },
      { id: "b", valorCentavos: 499, costoArs: new D(5), datos: null },
    ]);
    expect(r?.valorTotalCentavos).toBe(1497);
    expect(r?.costoTotalArs.toFixed()).toBe("15");
  });
});
