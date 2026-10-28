# PixelPeso — comparador de precios de juegos de Nintendo

@AGENTS.md

Sitio público en español que compara el precio de juegos de Nintendo Switch y
Switch 2 en cuatro regiones (Argentina, España, Europa, EE. UU.) y cuatro
métodos de pago (tarjeta argentina, tarjeta del exterior, gift card, key de
Instant Gaming), todo expresado en ARS con cotización oficial y blue. No vende
nada: compara, recomienda y enlaza.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | App en http://localhost:3000 (SQLite por defecto) |
| `npm run worker` | Worker con node-cron (todos los jobs programados) |
| `npm run job -- <nombre>` | Corre un job a mano (`npm run job -- --lista` para verlos) |
| `npm run db:setup` | Crea/actualiza la base (`prisma db push`) y genera el cliente |
| `npm test` | Tests unitarios y de parsers (Vitest) |
| `npm run test:e2e` | Test end-to-end (Playwright) con datos de prueba |
| `npm run lint` / `npm run format:check` / `npm run typecheck` | Calidad |
| `npm run fixtures:capturar` | Baja respuestas reales de cada fuente a `tests/fixtures/` |
| `docker compose up` | App + worker + Postgres |

## Estructura

- `config/` — todo lo configurable: regiones y países de "Europa", impuestos
  (IVA), monedas puente, gift cards, URLs de fuentes. **No hardcodear estas
  cosas en otro lado.**
- `src/lib/domain/` — lógica pura y testeada: dinero (decimal.js), conversión,
  impuestos, optimizador de gift cards, cálculo de opciones, recomendación,
  matcheo entre regiones.
- `src/lib/sources/` — clientes y parsers de cada fuente externa. Cada parser
  recibe texto/JSON y devuelve datos normalizados (testeable con fixtures).
- `src/lib/giftcards/` — proveedores de gift cards intercambiables (interfaz
  `ProveedorGiftCards`).
- `src/lib/data/` — consultas a la base que usa la app.
- `worker/` — jobs (`worker/jobs/*`), scheduler (`worker/index.ts`) y CLI.
- `prisma/schema.prisma` — schema único; `prisma.config.ts` deriva la versión
  Postgres si `DATABASE_URL` es `postgres://…`.
- `docs/` — fuentes, cálculos, decisiones y plan.

## Convenciones

- Todo el texto de la UI en español rioplatense; números y fechas con
  `src/lib/formato.ts` (es-AR). Nunca `toFixed`/`toLocaleString` sueltos en la UI.
- Dinero: siempre `Decimal` (`src/lib/domain/dinero.ts`) o strings decimales en
  los DTO. Nunca `number` para montos. Redondeo solo al mostrar.
- Next.js 16 con Cache Components: las lecturas de base van dentro de
  `<Suspense>` y llaman `await connection()` antes de consultar.
- Si una fuente falla, se muestra el último dato guardado con su fecha; nunca
  se rompe la página.
- No usar logos, tipografías ni marcas de Nintendo. Las portadas se enlazan por
  URL, no se re-alojan.
- Decisiones no obvias → `docs/decisiones.md`.
