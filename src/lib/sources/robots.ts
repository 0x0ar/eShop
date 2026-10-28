/**
 * Parser mínimo de robots.txt (RFC 9309): grupos por User-agent, Allow/Disallow
 * con comodines `*` y `$`, gana la regla más específica; Crawl-delay.
 */

interface Regla {
  permitir: boolean;
  patron: string;
}

interface Grupo {
  agentes: string[];
  reglas: Regla[];
  crawlDelay?: number;
}

export interface ReglasRobots {
  grupos: Grupo[];
  crawlDelayMs?: number;
}

export function parsearRobots(texto: string): ReglasRobots {
  const grupos: Grupo[] = [];
  let actual: Grupo | null = null;
  let leyendoAgentes = false;
  for (const lineaCruda of texto.split(/\r?\n/)) {
    const linea = lineaCruda.replace(/#.*$/, "").trim();
    if (!linea) continue;
    const i = linea.indexOf(":");
    if (i < 0) continue;
    const campo = linea.slice(0, i).trim().toLowerCase();
    const valor = linea.slice(i + 1).trim();
    if (campo === "user-agent") {
      if (!actual || !leyendoAgentes) {
        actual = { agentes: [], reglas: [] };
        grupos.push(actual);
      }
      actual.agentes.push(valor.toLowerCase());
      leyendoAgentes = true;
      continue;
    }
    leyendoAgentes = false;
    if (!actual) continue;
    if (campo === "allow" || campo === "disallow") {
      if (campo === "disallow" && valor === "") continue;
      actual.reglas.push({ permitir: campo === "allow", patron: valor });
    } else if (campo === "crawl-delay") {
      const n = Number(valor);
      if (Number.isFinite(n)) actual.crawlDelay = n;
    }
  }
  return { grupos };
}

function coincide(patron: string, ruta: string): boolean {
  const anclado = patron.endsWith("$");
  const cuerpo = (anclado ? patron.slice(0, -1) : patron)
    .split("*")
    .map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${cuerpo}${anclado ? "$" : ""}`).test(ruta);
}

function grupoPara(reglas: ReglasRobots, userAgent: string): Grupo | null {
  const ua = userAgent.toLowerCase();
  const token = ua.split("/")[0];
  const especifico = reglas.grupos.find((g) =>
    g.agentes.some((a) => a !== "*" && (token.includes(a) || a.includes(token))),
  );
  return especifico ?? reglas.grupos.find((g) => g.agentes.includes("*")) ?? null;
}

export function permitidoPorRobots(reglas: ReglasRobots, userAgent: string, ruta: string): boolean {
  const grupo = grupoPara(reglas, userAgent);
  if (grupo?.crawlDelay != null) reglas.crawlDelayMs = grupo.crawlDelay * 1000;
  if (!grupo) return true;
  let mejor: Regla | null = null;
  for (const r of grupo.reglas) {
    if (!coincide(r.patron, ruta)) continue;
    if (!mejor || r.patron.length > mejor.patron.length || (r.patron.length === mejor.patron.length && r.permitir)) {
      mejor = r;
    }
  }
  return mejor ? mejor.permitir : true;
}
