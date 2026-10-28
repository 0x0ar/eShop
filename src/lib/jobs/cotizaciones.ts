import { db } from "@/lib/db";
import { diaArgentina } from "@/lib/data/cotizaciones";
import { dec } from "@/lib/domain/dinero";
import { obtenerCotizacionesArs, obtenerCruzadas, type CotizacionObtenida } from "@/lib/sources/cotizaciones";
import { registrarError, registrarExito, type FuncionJob } from "./runner";

async function guardar(cots: CotizacionObtenida[]) {
  const dia = diaArgentina();
  await db.cotizacion.createMany({
    data: cots.map((c) => ({
      fuente: c.fuente,
      clave: c.clave,
      compra: c.compra?.toFixed() ?? null,
      venta: c.venta.toFixed(),
      fechaFuente: c.fechaFuente,
      dia,
    })),
  });
}

/** Actualiza cruzadas (Frankfurter) y cotizaciones a ARS (DolarAPI). Si una falla, la otra igual se guarda. */
export const jobCotizaciones: FuncionJob = async ({ log, contar }) => {
  const errores: string[] = [];
  let cruzadas: CotizacionObtenida[] = [];
  try {
    cruzadas = await obtenerCruzadas();
    await guardar(cruzadas);
    contar(cruzadas.length);
    await registrarExito("frankfurter", cruzadas.map((c) => `${c.clave}=${c.venta.toFixed()}`).join(" "));
  } catch (e) {
    errores.push(`Frankfurter: ${(e as Error).message}`);
    await registrarError("frankfurter", e);
  }

  try {
    const usdPorEur = async () => {
      const enMemoria = cruzadas.find((c) => c.clave === "FX:USD");
      if (enMemoria) return enMemoria.venta;
      const guardada = await db.cotizacion.findFirst({ where: { clave: "FX:USD" }, orderBy: { registrado: "desc" } });
      if (!guardada) throw new Error("No hay EUR/USD para derivar el euro blue");
      return dec(guardada.venta.toString());
    };
    const ars = await obtenerCotizacionesArs(usdPorEur);
    await guardar(ars);
    contar(ars.length);
    const derivado = ars.some((c) => c.fuente === "derivado");
    await registrarExito(
      "dolarapi",
      ars.map((c) => `${c.clave}=${c.venta.toFixed()}`).join(" ") + (derivado ? " (euro blue derivado)" : ""),
    );
    if (derivado) log("Euro blue derivado de dólar blue × EUR/USD");
  } catch (e) {
    errores.push(`DolarAPI: ${(e as Error).message}`);
    await registrarError("dolarapi", e);
  }

  if (errores.length === 2) throw new Error(errores.join(" | "));
  return errores.length ? `parcial: ${errores.join(" | ")}` : "ok";
};
