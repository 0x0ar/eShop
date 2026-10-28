# Plan de implementación

Cada etapa termina con `npm run lint`, `npm test` y `npm run build` limpios.

| #   | Etapa                                                                                                                          | Estado                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| 0   | Esqueleto Next.js 16 + TS estricto, config centralizada (`config/`), CLAUDE.md, docs                                           | Hecha                                                                    |
| 1   | Dominio puro + tests: dinero decimal, conversión, IVA, gift cards óptimas, opciones, recomendación, matcheo                    | Hecha                                                                    |
| 2   | Prisma (SQLite/Postgres), clientes y parsers de fuentes, worker con node-cron + CLI                                            | Hecha (parsers sin fixtures reales, ver abajo)                           |
| 3   | UI: inicio, búsqueda, ficha con tabla y recomendación filtrable, historial, wishlist, cotizaciones, "Cómo calculamos", legales | Hecha                                                                    |
| 4   | Alertas por email con doble opt-in, `/admin/estado`, cron de Vercel, Docker, README, e2e                                       | Hecha                                                                    |
| 5   | **Verificación de fuentes reales**: capturar fixtures, ajustar parsers, cargar ≥ 50 juegos y revisar la comparativa            | **Parcial**: todo verificado salvo el catálogo de América (sin AR ni US) |

## Etapa 5 — resultado (2026-10-28)

- Fixtures reales capturadas y parsers ajustados (`tests/fixtures/real/`).
- Datos reales cargados: 30 287 productos del catálogo europeo, precios de los
  200 juegos más populares en las 8 eShops europeas (1 599 precios),
  cotizaciones, 13 gift cards y keys de Instant Gaming. Comparativa revisada a
  mano (fórmulas verificadas con ejemplos reales).
- **Pendiente**: catálogo de América (Algolia de nintendo.com). Sin él no hay
  precios de Argentina ni de EE. UU. ni referencia de ahorro. Ver
  `docs/fuentes.md`, sección 3.
- **Limitación aceptada**: cobertura de keys de Instant Gaming muy baja por
  respetar robots.txt.
