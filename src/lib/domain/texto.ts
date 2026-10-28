/** Utilidades de texto para búsqueda y matcheo entre regiones. */

const SIMBOLOS = /[™®©℠]/g;

/** Minúsculas, sin tildes, sin símbolos de marca ni puntuación. */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(SIMBOLOS, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[’'`´]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const SUFIJOS_TITULO = [/ for nintendo switch$/, / nintendo switch$/];

/** Normalización específica de títulos de juegos (no elimina "switch 2 edition"). */
export function normalizarTitulo(titulo: string): string {
  let t = normalizarTexto(titulo);
  for (const s of SUFIJOS_TITULO) {
    if (!/switch 2 edition$/.test(t)) t = t.replace(s, "");
  }
  return t.trim();
}

const SUFIJOS_EMPRESA = new Set([
  "inc",
  "ltd",
  "llc",
  "co",
  "corp",
  "corporation",
  "gmbh",
  "sa",
  "sl",
  "srl",
  "ag",
  "plc",
  "limited",
  "entertainment",
  "games",
  "studio",
  "studios",
  "interactive",
  "publishing",
  "the",
]);

export function normalizarEditor(editor: string | null | undefined): string {
  if (!editor) return "";
  return normalizarTexto(editor)
    .split(" ")
    .filter((p) => p && !SUFIJOS_EMPRESA.has(p))
    .join(" ");
}

function bigramas(s: string): Map<string, number> {
  const m = new Map<string, number>();
  const t = s.replace(/ /g, "");
  for (let i = 0; i < t.length - 1; i++) {
    const b = t.slice(i, i + 2);
    m.set(b, (m.get(b) ?? 0) + 1);
  }
  return m;
}

/** Coeficiente de Sørensen–Dice sobre bigramas: 1 = iguales, 0 = nada en común. */
export function similitud(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const ba = bigramas(a);
  const bb = bigramas(b);
  let inter = 0;
  for (const [k, v] of ba) inter += Math.min(v, bb.get(k) ?? 0);
  const total = [...ba.values()].reduce((x, y) => x + y, 0) + [...bb.values()].reduce((x, y) => x + y, 0);
  return total === 0 ? 0 : (2 * inter) / total;
}

/** Slug para URLs: "The Legend of Zelda™: TOTK" → "the-legend-of-zelda-totk". */
export function slugificar(texto: string): string {
  return normalizarTexto(texto).replace(/ /g, "-").slice(0, 80).replace(/-+$/, "");
}
