import type Decimal from "decimal.js";
import { REGIONES_GIFTCARD, paisesDeRegionKey, permitePagoMixto } from "@config/giftcards";
import { METODOS_PAGO, type MetodoPago, type Impuesto, IMPUESTOS } from "@config/impuestos";
import { TIPOS_COTIZACION, type TipoCotizacion } from "@config/monedas";
import { REGIONES_COMPARACION, paisesDeRegion, nombrePais, type RegionComparacion } from "@config/regiones";
import { aArs, MonedaNoSoportadaError, type Cotizaciones } from "./cotizaciones";
import { aCentavos, D, desdeCentavos } from "./dinero";
import { optimizarGiftCards, type TarjetaDisponible } from "./giftcards";
import { aplicarImpuestos } from "./impuestos";
import type { CeldaDTO, DetalleGiftCardDTO, OpcionDTO, Requisito } from "./tipos";

export interface PrecioTienda {
  pais: string;
  moneda: string;
  regular: Decimal;
  oferta: Decimal | null;
  ofertaHasta: Date | null;
  actualizado: Date;
  url: string | null;
}

export interface OfertaKey {
  proveedor: string;
  nombreProveedor: string;
  esMarketplace: boolean;
  titulo: string;
  precio: Decimal;
  moneda: string;
  regionActivacion: string;
  url: string;
  disponible: boolean;
  actualizado: Date;
}

export interface OfertaGiftCard {
  proveedor: string;
  nombreProveedor: string;
  esMarketplace: boolean;
  regionTarjeta: string;
  monedaTarjeta: string;
  valor: Decimal;
  precio: Decimal;
  monedaPrecio: string;
  url: string | null;
  disponible: boolean;
  actualizado: Date;
}

export interface EntradaComparacion {
  precios: PrecioTienda[];
  keys: OfertaKey[];
  giftcards: OfertaGiftCard[];
  cotizaciones: Cotizaciones;
  impuestos?: Impuesto[];
  regiones?: readonly RegionComparacion[];
}

const fmt = (d: Decimal) => d.toFixed();

function precioVigente(p: PrecioTienda): Decimal {
  return p.oferta && p.oferta.lt(p.regular) ? p.oferta : p.regular;
}

function requisitoCuenta(pais: string): Requisito {
  return { tipo: "cuenta", paises: [pais] };
}

function celdaTarjeta(
  region: RegionComparacion,
  metodo: "tarjeta_ar" | "tarjeta_exterior",
  tipo: TipoCotizacion,
  p: PrecioTienda,
  c: Cotizaciones,
  impuestos: Impuesto[],
): CeldaDTO {
  const precio = precioVigente(p);
  const conv = aArs(precio, p.moneda, tipo, c);
  const conImp = aplicarImpuestos(conv.ars, metodo, impuestos);
  const requisitos: Requisito[] = [requisitoCuenta(p.pais), { tipo: metodo, pais: p.pais }];
  return {
    region,
    metodo,
    tipo,
    pais: p.pais,
    ars: fmt(conImp.total),
    arsSinImpuestos: fmt(conv.ars),
    impuestos: conImp.impuestos.map((i) => ({ nombre: i.nombre, tasa: fmt(i.tasa), monto: fmt(i.monto) })),
    precio: fmt(precio),
    precioRegular: fmt(p.regular),
    moneda: p.moneda,
    enOferta: !precio.eq(p.regular),
    ofertaHasta: p.ofertaHasta?.toISOString() ?? null,
    monedaPuente: conv.monedaPuente,
    cotizacion: fmt(conv.cotizacion),
    actualizado: p.actualizado.toISOString(),
    url: p.url,
    requisitos,
  };
}

function celdaGiftCard(
  region: RegionComparacion,
  tipo: TipoCotizacion,
  p: PrecioTienda,
  ofertas: OfertaGiftCard[],
  c: Cotizaciones,
  impuestos: Impuesto[],
): CeldaDTO | null {
  const precio = precioVigente(p);
  const compatibles = ofertas.filter(
    (o) => o.disponible && o.monedaTarjeta === p.moneda && (REGIONES_GIFTCARD[o.regionTarjeta]?.paises ?? []).includes(p.pais),
  );
  if (compatibles.length === 0) return null;

  const tarjetas: TarjetaDisponible<OfertaGiftCard & { costoArs: Decimal }>[] = [];
  for (const o of compatibles) {
    let costoArs: Decimal;
    try {
      costoArs = aplicarImpuestos(aArs(o.precio, o.monedaPrecio, tipo, c).ars, "gift_card", impuestos).total;
    } catch (e) {
      if (e instanceof MonedaNoSoportadaError) continue;
      throw e;
    }
    tarjetas.push({
      id: `${o.proveedor}:${o.regionTarjeta}:${o.valor}`,
      valorCentavos: aCentavos(o.valor),
      costoArs,
      datos: { ...o, costoArs },
    });
  }

  const mixto = permitePagoMixto(p.pais);
  const costoPorCentavoRestante = mixto
    ? aplicarImpuestos(aArs(new D("0.01"), p.moneda, tipo, c).ars, "tarjeta_exterior", impuestos).total
    : null;
  const combo = optimizarGiftCards(aCentavos(precio), tarjetas, { costoPorCentavoRestante });
  if (!combo || combo.lineas.length === 0) return null;

  const tiendasMarketplace = Array.from(
    new Set(combo.lineas.filter((l) => l.tarjeta.datos.esMarketplace).map((l) => l.tarjeta.datos.nombreProveedor)),
  );
  const regionTarjeta = combo.lineas[0].tarjeta.datos.regionTarjeta;
  const requisitos: Requisito[] = [requisitoCuenta(p.pais), { tipo: "gift_card", region: regionTarjeta }];
  if (tiendasMarketplace.length > 0) requisitos.push({ tipo: "marketplace", tiendas: tiendasMarketplace });
  if (combo.restanteCentavos > 0) requisitos.push({ tipo: "pago_mixto", pais: p.pais });

  const detalle: DetalleGiftCardDTO = {
    lineas: combo.lineas.map((l) => ({
      proveedor: l.tarjeta.datos.proveedor,
      nombreProveedor: l.tarjeta.datos.nombreProveedor,
      esMarketplace: l.tarjeta.datos.esMarketplace,
      regionTarjeta: l.tarjeta.datos.regionTarjeta,
      valor: fmt(l.tarjeta.datos.valor),
      moneda: l.tarjeta.datos.monedaTarjeta,
      precio: fmt(l.tarjeta.datos.precio),
      monedaPrecio: l.tarjeta.datos.monedaPrecio,
      cantidad: l.cantidad,
      costoArsUnitario: fmt(l.tarjeta.costoArs),
      url: l.tarjeta.datos.url,
    })),
    valorTotal: fmt(desdeCentavos(combo.valorTotalCentavos)),
    sobrante: fmt(desdeCentavos(combo.sobranteCentavos)),
    restante: fmt(desdeCentavos(combo.restanteCentavos)),
    costoRestanteArs: fmt(combo.costoRestanteArs),
    moneda: p.moneda,
  };
  const actualizado = combo.lineas
    .map((l) => l.tarjeta.datos.actualizado)
    .reduce((a, b) => (a < b ? a : b), p.actualizado);
  const primera = combo.lineas[0].tarjeta.datos;
  const conv = aArs(primera.precio, primera.monedaPrecio, tipo, c);
  return {
    region,
    metodo: "gift_card",
    tipo,
    pais: p.pais,
    ars: fmt(combo.costoTotalArs),
    arsSinImpuestos: fmt(combo.costoTotalArs),
    impuestos: [],
    precio: fmt(precio),
    precioRegular: fmt(p.regular),
    moneda: p.moneda,
    enOferta: !precio.eq(p.regular),
    ofertaHasta: p.ofertaHasta?.toISOString() ?? null,
    monedaPuente: conv.monedaPuente,
    cotizacion: fmt(conv.cotizacion),
    actualizado: actualizado.toISOString(),
    url: p.url,
    requisitos,
    giftcards: detalle,
  };
}

function celdaKey(
  region: RegionComparacion,
  tipo: TipoCotizacion,
  paisesRegion: string[],
  keys: OfertaKey[],
  c: Cotizaciones,
  impuestos: Impuesto[],
): CeldaDTO[] {
  const celdas: CeldaDTO[] = [];
  for (const k of keys) {
    if (!k.disponible) continue;
    const validos = paisesDeRegionKey(k.regionActivacion);
    const paises = validos === "todos" ? paisesRegion : paisesRegion.filter((p) => validos.includes(p));
    if (paises.length === 0) continue;
    let conv;
    try {
      conv = aArs(k.precio, k.moneda, tipo, c);
    } catch (e) {
      if (e instanceof MonedaNoSoportadaError) continue;
      throw e;
    }
    const conImp = aplicarImpuestos(conv.ars, "key_ig", impuestos);
    const requisitos: Requisito[] = [{ tipo: "cuenta", paises }, { tipo: "key_region", region: k.regionActivacion }];
    if (k.esMarketplace) requisitos.push({ tipo: "marketplace", tiendas: [k.nombreProveedor] });
    celdas.push({
      region,
      metodo: "key_ig",
      tipo,
      pais: paises[0],
      ars: fmt(conImp.total),
      arsSinImpuestos: fmt(conv.ars),
      impuestos: conImp.impuestos.map((i) => ({ nombre: i.nombre, tasa: fmt(i.tasa), monto: fmt(i.monto) })),
      precio: fmt(k.precio),
      precioRegular: null,
      moneda: k.moneda,
      enOferta: false,
      ofertaHasta: null,
      monedaPuente: conv.monedaPuente,
      cotizacion: fmt(conv.cotizacion),
      actualizado: k.actualizado.toISOString(),
      url: k.url,
      requisitos,
      key: {
        proveedor: k.proveedor,
        nombreProveedor: k.nombreProveedor,
        titulo: k.titulo,
        precio: fmt(k.precio),
        moneda: k.moneda,
        regionActivacion: k.regionActivacion,
        url: k.url,
        esMarketplace: k.esMarketplace,
      },
    });
  }
  return celdas;
}

function ordenarPorCosto(celdas: CeldaDTO[]): CeldaDTO[] {
  return celdas.sort((a, b) => new D(a.ars).cmp(new D(b.ars)));
}

/** Para cada país se queda con la celda más barata (puede haber varias keys/tiendas). */
function mejorPorPais(celdas: CeldaDTO[]): CeldaDTO[] {
  const porPais = new Map<string, CeldaDTO>();
  for (const celda of ordenarPorCosto(celdas)) {
    const clave = celda.metodo === "key_ig" ? `${celda.key?.proveedor}:${celda.key?.regionActivacion}` : celda.pais;
    if (!porPais.has(clave)) porPais.set(clave, celda);
  }
  return ordenarPorCosto(Array.from(porPais.values()));
}

function motivoSinDatos(region: RegionComparacion, metodo: MetodoPago, preciosRegion: PrecioTienda[]): string {
  if (metodo === "key_ig") return "No encontramos keys para esta región";
  if (preciosRegion.length === 0) {
    return region === "EU"
      ? "No está a la venta en las eShops europeas configuradas"
      : `No está a la venta en la eShop de ${nombrePais(paisesDeRegion(region)[0])}`;
  }
  if (metodo === "gift_card") return "No hay gift cards compatibles con esta eShop";
  return "Sin datos";
}

/**
 * Calcula todas las combinaciones región × método × cotización.
 * Las fórmulas están documentadas en docs/calculos.md.
 */
export function calcularOpciones(entrada: EntradaComparacion): OpcionDTO[] {
  const { cotizaciones: c } = entrada;
  const impuestos = entrada.impuestos ?? IMPUESTOS;
  const regiones = entrada.regiones ?? REGIONES_COMPARACION;
  const opciones: OpcionDTO[] = [];

  for (const region of regiones) {
    const paises = paisesDeRegion(region);
    const preciosRegion = entrada.precios.filter((p) => paises.includes(p.pais));
    for (const metodo of METODOS_PAGO) {
      const candidatos = { oficial: [] as CeldaDTO[], blue: [] as CeldaDTO[] };
      let errorMoneda: string | null = null;
      for (const tipo of TIPOS_COTIZACION) {
        const celdas: CeldaDTO[] = [];
        if (metodo === "key_ig") {
          celdas.push(...celdaKey(region, tipo, paises, entrada.keys, c, impuestos));
        } else {
          for (const p of preciosRegion) {
            try {
              const celda =
                metodo === "gift_card"
                  ? celdaGiftCard(region, tipo, p, entrada.giftcards, c, impuestos)
                  : celdaTarjeta(region, metodo, tipo, p, c, impuestos);
              if (celda) celdas.push(celda);
            } catch (e) {
              if (e instanceof MonedaNoSoportadaError) {
                errorMoneda = e.message;
                continue;
              }
              throw e;
            }
          }
        }
        candidatos[tipo] = mejorPorPais(celdas);
      }
      const vacio = candidatos.oficial.length === 0 && candidatos.blue.length === 0;
      opciones.push({
        id: `${region}:${metodo}`,
        region,
        metodo,
        candidatos,
        motivoNoDisponible: vacio ? (errorMoneda ?? motivoSinDatos(region, metodo, preciosRegion)) : null,
      });
    }
  }
  return opciones;
}
