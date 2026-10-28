import { TIPOS_COTIZACION, type TipoCotizacion } from "@config/monedas";
import { REGIONES_COMPARACION, paisesDeRegion, type RegionComparacion } from "@config/regiones";
import { db } from "@/lib/db";
import { aArs } from "@/lib/domain/cotizaciones";
import { dec } from "@/lib/domain/dinero";
import type { OpcionDTO } from "@/lib/domain/tipos";
import { cotizacionesPorDia, cotizacionesVigentes, diaArgentina, type CotizacionGuardada } from "./cotizaciones";
import { opcionesDeJuego, unirUrls } from "./comparacion";

export interface PrecioPaisDTO {
  pais: string;
  moneda: string;
  regular: string;
  oferta: string | null;
  ofertaHasta: string | null;
  actualizado: string;
  url: string | null;
  minimoHistorico: string | null;
  esMinimoHistorico: boolean;
}

export interface PuntoHistorial {
  dia: string;
  /** ARS sin impuestos por región y cotización: "AR:oficial" → "12345.6" */
  valores: Record<string, string>;
}

export interface FichaJuego {
  juego: {
    id: string;
    slug: string;
    titulo: string;
    editor: string | null;
    plataforma: string;
    tipo: string;
    lanzamiento: string | null;
    imagenUrl: string | null;
    descripcion: string | null;
    origen: string;
  };
  opciones: OpcionDTO[] | null;
  faltanCotizaciones: string[];
  cotizaciones: CotizacionGuardada[];
  precios: PrecioPaisDTO[];
  historial: PuntoHistorial[];
  minimoHistoricoArs: Record<TipoCotizacion, { valor: string; dia: string; region: RegionComparacion } | null>;
}

const DIAS_HISTORIAL = 365;

export async function fichaJuego(slug: string): Promise<FichaJuego | null> {
  const juego = await db.juego.findUnique({
    where: { slug },
    include: { productos: { select: { urls: true } }, precios: true },
  });
  if (!juego) return null;

  const { cotizaciones, detalle, faltantes } = await cotizacionesVigentes();
  const opciones = cotizaciones ? await opcionesDeJuego(juego.id, cotizaciones) : null;
  const urls = unirUrls(juego.productos);

  const desde = diaArgentina(new Date(Date.now() - DIAS_HISTORIAL * 86_400_000));
  const historico = await db.precioHistorico.findMany({
    where: { juegoId: juego.id, dia: { gte: desde } },
    orderBy: { dia: "asc" },
  });

  // Mínimo histórico en la moneda de cada eShop.
  const minimoPorPais = new Map<string, ReturnType<typeof dec>>();
  for (const h of historico) {
    const v = dec((h.oferta ?? h.regular).toString());
    const actual = minimoPorPais.get(h.pais);
    if (!actual || v.lt(actual)) minimoPorPais.set(h.pais, v);
  }
  const precios: PrecioPaisDTO[] = juego.precios
    .map((p) => {
      const vigente = p.oferta && (!p.ofertaHasta || p.ofertaHasta > new Date()) ? p.oferta : null;
      const actual = dec((vigente ?? p.regular).toString());
      const minimo = minimoPorPais.get(p.pais) ?? null;
      return {
        pais: p.pais,
        moneda: p.moneda,
        regular: p.regular.toString(),
        oferta: vigente?.toString() ?? null,
        ofertaHasta: vigente ? (p.ofertaHasta?.toISOString() ?? null) : null,
        actualizado: p.actualizado.toISOString(),
        url: urls[p.pais] ?? null,
        minimoHistorico: minimo?.toFixed() ?? null,
        esMinimoHistorico: minimo ? actual.lte(minimo) : false,
      };
    })
    .sort((a, b) => a.pais.localeCompare(b.pais));

  // Historial en ARS por región: mínimo entre los países de la región, sin impuestos.
  const cotsPorDia = historico.length ? await cotizacionesPorDia(desde) : new Map();
  const porDia = new Map<string, typeof historico>();
  for (const h of historico) porDia.set(h.dia, [...(porDia.get(h.dia) ?? []), h]);
  const historial: PuntoHistorial[] = [];
  const minimoHistoricoArs: FichaJuego["minimoHistoricoArs"] = { oficial: null, blue: null };
  const diasCotizacion = Array.from(cotsPorDia.keys()).sort();
  for (const [dia, filas] of porDia) {
    // Si ese día no hubo cotización guardada, se usa la última anterior.
    const diaCot = diasCotizacion.filter((d) => d <= dia).pop() ?? diasCotizacion[0];
    const c = diaCot ? cotsPorDia.get(diaCot) : undefined;
    if (!c) continue;
    const valores: Record<string, string> = {};
    for (const region of REGIONES_COMPARACION) {
      const paises = paisesDeRegion(region);
      for (const tipo of TIPOS_COTIZACION) {
        let mejor: ReturnType<typeof dec> | null = null;
        for (const f of filas.filter((x) => paises.includes(x.pais))) {
          try {
            const ars = aArs(dec((f.oferta ?? f.regular).toString()), f.moneda, tipo, c).ars;
            if (!mejor || ars.lt(mejor)) mejor = ars;
          } catch {
            // moneda sin conversión configurada: se omite
          }
        }
        if (mejor) {
          valores[`${region}:${tipo}`] = mejor.toFixed(2);
          const min = minimoHistoricoArs[tipo];
          if (!min || mejor.lt(dec(min.valor))) minimoHistoricoArs[tipo] = { valor: mejor.toFixed(2), dia, region };
        }
      }
    }
    historial.push({ dia, valores });
  }

  return {
    juego: {
      id: juego.id,
      slug: juego.slug,
      titulo: juego.titulo,
      editor: juego.editor,
      plataforma: juego.plataforma,
      tipo: juego.tipo,
      lanzamiento: juego.lanzamiento?.toISOString() ?? null,
      imagenUrl: juego.imagenUrl,
      descripcion: juego.descripcion,
      origen: juego.origen,
    },
    opciones,
    faltanCotizaciones: faltantes,
    cotizaciones: detalle,
    precios,
    historial,
    minimoHistoricoArs,
  };
}
