# Plan de implementación

Cada etapa termina con `npm run lint`, `npm test` y `npm run build` limpios.

| #   | Etapa                                                                                                                          | Estado                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| 0   | Esqueleto Next.js 16 + TS estricto, config centralizada (`config/`), CLAUDE.md, docs                                           | Hecha                                                                  |
| 1   | Dominio puro + tests: dinero decimal, conversión, IVA, gift cards óptimas, opciones, recomendación, matcheo                    | Hecha                                                                  |
| 2   | Prisma (SQLite/Postgres), clientes y parsers de fuentes, worker con node-cron + CLI                                            | Hecha (parsers sin fixtures reales, ver abajo)                         |
| 3   | UI: inicio, búsqueda, ficha con tabla y recomendación filtrable, historial, wishlist, cotizaciones, "Cómo calculamos", legales | Hecha                                                                  |
| 4   | Alertas por email con doble opt-in, `/admin/estado`, cron de Vercel, Docker, README, e2e                                       | Hecha                                                                  |
| 5   | **Verificación de fuentes reales**: capturar fixtures, ajustar parsers, cargar ≥ 50 juegos y revisar la comparativa            | **Bloqueada**: la red del entorno de desarrollo no llega a las fuentes |

## Etapa 5 — qué falta y cómo retomarla

1. Habilitar acceso de red a los dominios de `docs/fuentes.md`.
2. `npm run fixtures:capturar` → guarda respuestas reales en `tests/fixtures/real/`.
3. `npm test` corre los tests de parsers contra esas fixtures (hoy se saltean
   si no existen) y revela qué hay que ajustar.
4. Completar las secciones "Verificado" de `docs/fuentes.md` (moneda de la eShop
   argentina, máximo de ids, campos de Switch 2, rutas de euro blue, HTML de
   Instant Gaming).
5. `npm run job -- todo` con `CATALOGO_LIMITE` chico, revisar `/admin/estado`
   (juegos sin matcheo) y la ficha de ≥ 50 juegos populares
   (`npm run job -- populares` los prioriza).
