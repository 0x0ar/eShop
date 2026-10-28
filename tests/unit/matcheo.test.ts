import { describe, expect, it } from "vitest";
import { matchearCatalogos, puntajeMatch, type ProductoRegional } from "@/lib/domain/matcheo";
import { normalizarEditor, normalizarTitulo, slugificar, similitud } from "@/lib/domain/texto";

function p(nsuid: string, titulo: string, extra: Partial<ProductoRegional> = {}): ProductoRegional {
  return {
    nsuid,
    titulo,
    editor: "Nintendo",
    plataforma: "SWITCH",
    tipo: "JUEGO",
    lanzamiento: new Date("2023-05-12"),
    ...extra,
  };
}

describe("normalización", () => {
  it("quita tildes, marcas y puntuación", () => {
    expect(normalizarTitulo("The Legend of Zelda™: Tears of the Kingdom")).toBe(
      "the legend of zelda tears of the kingdom",
    );
    expect(normalizarTitulo("Pokémon™ Escarlata")).toBe("pokemon escarlata");
    expect(normalizarTitulo("Mario & Luigi: Brothership")).toBe("mario and luigi brothership");
  });

  it("no borra la marca de Switch 2 Edition", () => {
    expect(normalizarTitulo("Super Mario Party Jamboree – Nintendo Switch 2 Edition")).toContain("switch 2 edition");
  });

  it("normaliza editores", () => {
    expect(normalizarEditor("Square Enix Co., Ltd.")).toBe("square enix");
    expect(normalizarEditor("SQUARE ENIX")).toBe("square enix");
  });

  it("calcula similitud", () => {
    expect(similitud("zelda", "zelda")).toBe(1);
    expect(similitud("zelda", "zeldaa")).toBeGreaterThan(0.8);
    expect(similitud("mario", "sonic")).toBeLessThan(0.3);
  });

  it("arma slugs", () => {
    expect(slugificar("Pokémon™ Legends: Z-A")).toBe("pokemon-legends-z-a");
  });
});

describe("puntaje de matcheo", () => {
  it("da 0 si cambia la plataforma o el tipo", () => {
    expect(puntajeMatch(p("1", "Zelda"), p("2", "Zelda", { plataforma: "SWITCH2" }))).toBe(0);
    expect(puntajeMatch(p("1", "Zelda"), p("2", "Zelda", { tipo: "DLC" }))).toBe(0);
  });

  it("acepta diferencias menores de título y editor", () => {
    const a = p("1", "Hollow Knight", { editor: "Team Cherry" });
    const e = p("2", "Hollow Knight™", { editor: "Team Cherry Pty Ltd" });
    expect(puntajeMatch(a, e)).toBeGreaterThan(0.9);
  });
});

describe("matcheo entre catálogos", () => {
  it("matchea por título, editor y fecha", () => {
    const argentina = [
      p("A1", "Super Mario Odyssey", { lanzamiento: new Date("2017-10-27") }),
      p("A2", "Celeste", { editor: "Matt Makes Games" }),
    ];
    const europa = [
      p("E1", "Celeste", { editor: "Matt Makes Games Inc." }),
      p("E2", "Super Mario Odyssey™", { lanzamiento: new Date("2017-10-27") }),
    ];
    const r = matchearCatalogos(argentina, europa);
    expect(r.pares.map((x) => [x.argentina.nsuid, x.europa.nsuid]).sort()).toEqual([
      ["A1", "E2"],
      ["A2", "E1"],
    ]);
    expect(r.sinMatchArgentina).toEqual([]);
  });

  it("no matchea juegos distintos con nombres parecidos de distinta plataforma", () => {
    const argentina = [p("A1", "Mario Kart World", { plataforma: "SWITCH2" })];
    const europa = [p("E1", "Mario Kart 8 Deluxe")];
    const r = matchearCatalogos(argentina, europa);
    expect(r.pares).toHaveLength(0);
    expect(r.sinMatchArgentina[0].producto.nsuid).toBe("A1");
  });

  it("registra los ambiguos en lugar de adivinar", () => {
    const argentina = [p("A1", "Pac-Man World", { editor: null, lanzamiento: null })];
    const europa = [
      p("E1", "PAC-MAN World", { editor: null, lanzamiento: null }),
      p("E2", "Pac Man World", { editor: null, lanzamiento: null }),
    ];
    const r = matchearCatalogos(argentina, europa);
    expect(r.pares).toHaveLength(0);
    expect(r.sinMatchArgentina[0].motivo).toMatch(/Ambiguo/);
  });

  it("aplica overrides manuales, incluso para forzar 'sin match'", () => {
    const argentina = [p("A1", "Juego X"), p("A2", "Juego Y")];
    const europa = [p("E1", "Otro nombre totalmente distinto"), p("E2", "Juego Y")];
    const r = matchearCatalogos(argentina, europa, [
      { nsuidArgentina: "A1", nsuidEuropa: "E1" },
      { nsuidArgentina: "A2", nsuidEuropa: null },
    ]);
    expect(r.pares).toHaveLength(1);
    expect(r.pares[0]).toMatchObject({ origen: "override", argentina: { nsuid: "A1" }, europa: { nsuid: "E1" } });
    expect(r.sinMatchEuropa.map((x) => x.producto.nsuid)).toEqual(["E2"]);
  });

  it("no asigna el mismo producto europeo a dos americanos", () => {
    const argentina = [
      p("A1", "Tetris 99"),
      p("A2", "Tetris 99", { editor: "Otro", lanzamiento: new Date("2010-01-01") }),
    ];
    const europa = [p("E1", "Tetris 99")];
    const r = matchearCatalogos(argentina, europa);
    expect(r.pares).toHaveLength(1);
    expect(r.pares[0].argentina.nsuid).toBe("A1");
    expect(r.sinMatchArgentina.map((x) => x.producto.nsuid)).toEqual(["A2"]);
  });
});
