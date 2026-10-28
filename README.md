# PixelPeso

Comparador público de precios de juegos de **Nintendo Switch y Switch 2**.
Compara la eShop de **Argentina, España, Europa** (el país más barato de una
lista configurable) **y Estados Unidos**, con **tarjeta argentina, tarjeta del
exterior, gift cards y keys de Instant Gaming**, todo en **pesos** con
**dólar/euro oficial y blue**, y recomienda la opción más barata según lo que
tenga cada persona.

No vende nada: compara, recomienda y enlaza a la tienda.

> **Estado de las fuentes (2026-10-28):** todas verificadas contra respuestas
> reales: precios de Nintendo (Argentina en pesos, EE. UU. y eShops europeas),
> catálogos de Argentina y Europa, DolarAPI, Frankfurter e Instant Gaming.
> Detalle y límites en [`docs/fuentes.md`](docs/fuentes.md).

## Índice

- [Stack](#stack)
- [Instalación local](#instalación-local)
- [Variables de entorno](#variables-de-entorno)
- [Jobs](#jobs)
- [Verificar las fuentes](#verificar-las-fuentes)
- [Tests y calidad](#tests-y-calidad)
- [Despliegue en un VPS (Docker)](#despliegue-en-un-vps-docker)
- [Despliegue en Vercel](#despliegue-en-vercel)
- [Limitaciones conocidas](#limitaciones-conocidas)
- [Documentación](#documentación)

## Stack

Next.js 16 (App Router, Cache Components) · TypeScript estricto · Tailwind CSS 4
· componentes estilo shadcn/ui · next-themes · Prisma 7 (SQLite en local,
PostgreSQL en producción) · Recharts · decimal.js · cheerio · node-cron ·
Vitest · Playwright.

## Instalación local

Requisitos: Node.js 22.12 o superior. Para SQLite hace falta poder compilar
`better-sqlite3` (Python 3 y un compilador de C++); en macOS y la mayoría de los
Linux ya están o vienen con las herramientas de desarrollo.

```bash
npm install
```

```bash
cp .env.example .env
```

```bash
npm run db:setup
```

```bash
npm run dev
```

La app queda en http://localhost:3000. Para cargar datos reales, en otra terminal:

```bash
npm run job -- todo
```

Para probar con un catálogo chico primero, definí `CATALOGO_LIMITE=200` en `.env`.

### Datos de demostración

Para ver la interfaz sin acceso a las fuentes:

```bash
npm run db:seed:demo
```

```bash
npm run job -- resumen
```

Son 12 juegos **inventados** con precios inventados; el sitio muestra un aviso
mientras existan. Se borran con `npm run db:seed:demo -- --borrar`. El seed no
corre con `NODE_ENV=production`.

## Variables de entorno

Todas están en [`.env.example`](.env.example) con su valor por defecto.

| Variable                                                                | Para qué                                                                  |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `DATABASE_URL`                                                          | `file:./dev.db` (SQLite) o `postgresql://…` (Postgres)                    |
| `SITE_URL`                                                              | URL pública, para los links de los emails                                 |
| `ADMIN_TOKEN`                                                           | Token (≥ 12 caracteres) para `/admin/estado`. Vacío = panel deshabilitado |
| `CRON_SECRET`                                                           | Protege `/api/cron/[job]` (Vercel Cron manda `Authorization: Bearer …`)   |
| `EMAIL_PROVIDER`                                                        | `console` (desarrollo), `smtp` o `resend`                                 |
| `EMAIL_FROM`, `SMTP_*`, `RESEND_API_KEY`                                | Credenciales del proveedor de email                                       |
| `EUROPA_PAISES`                                                         | Países de la región "Europa" (default `DE,FR,IT,PT,NL,PL,GB`)             |
| `GIFTCARD_PROVEEDORES`                                                  | Proveedores de gift cards habilitados (`instant-gaming,manual`)           |
| `NINTENDO_*`, `DOLARAPI_*`, `FRANKFURTER_URL`, `INSTANT_GAMING_*`       | URLs y parámetros de las fuentes                                          |
| `SCRAPER_USER_AGENT`, `SCRAPER_MIN_INTERVAL_MS`, `SCRAPER_CACHE_TTL_MS` | Scraping respetuoso                                                       |
| `CATALOGO_LIMITE`, `POPULARES_CANTIDAD`                                 | Limitar el tamaño de las corridas                                         |
| `CRON_*`, `TZ_WORKER`                                                   | Horarios del worker                                                       |

Lo que no es secreto ni depende del entorno vive en `config/`: impuestos
(`config/impuestos.ts`, **único lugar donde se define el IVA y a qué métodos se
aplica**), monedas, regiones, gift cards y ofertas cargadas a mano
(`config/giftcards-manual.json`).

## Jobs

El worker (`npm run worker`) corre todo con node-cron:

| Job            | Default        | Qué hace                                                   |
| -------------- | -------------- | ---------------------------------------------------------- |
| `cotizaciones` | cada 30 min    | Dólar/euro oficial y blue + cruzadas                       |
| `catalogo`     | 04:00          | Catálogos de América y Europa + matcheo entre regiones     |
| `scrapers`     | 05:30          | Keys y gift cards; después `resumen`                       |
| `precios`      | 06:15 y 18:15  | Precios de todas las eShops; después `resumen` y `alertas` |
| `limpieza`     | domingos 03:00 | Caché HTTP, logs viejos y alertas sin confirmar            |

Cualquier job se corre a mano:

```bash
npm run job -- --lista
```

```bash
npm run job -- cotizaciones precios
```

Otros: `populares` (precios solo de los N juegos más populares, rápido),
`rematchear` (rehace el matcheo tras cargar overrides), `resumen`, `alertas` y
`todo` (cotizaciones → catálogo → precios → scrapers).

Cada ejecución queda registrada (tabla `EjecucionJob`) y el estado de cada
fuente se ve en `/admin/estado`, junto con los productos sin matcheo y el
formulario de overrides.

## Verificar las fuentes

Desde una máquina con acceso a internet:

```bash
npm run fixtures:capturar
```

Guarda respuestas reales en `tests/fixtures/real/`. Después:

```bash
npm test
```

Los tests de `tests/parsers/fixtures-reales.test.ts` dejan de saltearse y
muestran qué parser hay que ajustar. Completá lo marcado **A verificar** en
[`docs/fuentes.md`](docs/fuentes.md) (moneda de la eShop argentina, máximo de
ids, campos de Switch 2, euro blue, HTML de Instant Gaming) y commiteá las
fixtures.

## Tests y calidad

```bash
npm test
```

```bash
npm run test:e2e
```

```bash
npm run lint && npm run format:check && npm run typecheck && npm run build
```

- Vitest: conversión de monedas, IVA, combinación óptima de gift cards, matcheo,
  cálculo de opciones, recomendación, parsers (formato documentado + fixtures
  reales cuando existen) y robots.txt.
- Playwright: buscar → ficha → recomendación (y filtrarla por perfil), ordenar
  la tabla, wishlist compartida, alta de alerta y páginas de cotizaciones y
  cálculo, en escritorio y celular. Usa una base SQLite propia con los datos de
  demostración.

## Despliegue en un VPS (Docker)

```bash
cp .env.example .env
```

Editá `.env` (`SITE_URL`, `ADMIN_TOKEN`, email, `POSTGRES_PASSWORD`). La
`DATABASE_URL` la arma `docker-compose.yml` para el Postgres del compose.

```bash
docker compose up -d --build
```

Levanta `db` (Postgres 17), `esquema` (crea las tablas y termina), `app`
(puerto 3000, configurable con `PUERTO`) y `worker`. Para la primera carga:

```bash
docker compose exec worker npm run job -- todo
```

Poné un proxy inverso con HTTPS (Caddy, nginx) delante del puerto 3000. Los datos
de Postgres quedan en el volumen `datos-db`.

Para actualizar: `git pull` y de nuevo `docker compose up -d --build` (el
servicio `esquema` aplica los cambios de schema).

## Despliegue en Vercel

1. Creá una base Postgres gestionada (Neon, Supabase, Vercel Postgres…) y
   definí `DATABASE_URL` en el proyecto. El build (`vercel.json`) genera el
   cliente de Prisma para Postgres.
2. Creá las tablas una vez desde tu máquina:

   ```bash
   DATABASE_URL="postgresql://…" npx prisma db push
   ```

3. Definí `CRON_SECRET`, `SITE_URL`, `ADMIN_TOKEN` y el email (Resend es lo más
   simple en Vercel).
4. **Qué corre en Vercel**: la app y los jobs livianos por Vercel Cron
   (`vercel.json`): `cotizaciones` cada 30 min, `populares` dos veces por día
   (incluye `resumen` y `alertas`) y `limpieza`.
5. **Qué no conviene correr en Vercel**: `catalogo`, `precios` completo y
   `scrapers` duran más que el límite de una función (miles de requests, con
   pausas de varios segundos en el scraping). Corrélos en un worker aparte
   contra la misma `DATABASE_URL`: un VPS chico con
   `docker compose up -d db worker` (apuntando a la base gestionada), un cron de
   GitHub Actions que haga `npm ci && npm run job -- catalogo precios scrapers`, o
   Railway/Fly/Render. El scraping no usa navegador headless; si algún día hiciera
   falta Playwright, iría solo en ese worker.

## Limitaciones conocidas

- **Precios de Argentina en pesos**: la eShop argentina cobra en ARS, así que
  oficial y blue dan lo mismo para Argentina. Con tarjeta argentina se suma el
  IVA configurado; está por confirmar si el precio publicado ya incluye algún
  impuesto. Las APIs de Nintendo no son oficiales y pueden cambiar.
- **Euro blue**: DolarAPI no lo publica; se deriva de dólar blue × EUR/USD y se
  marca como "Derivado".
- **Gift cards**: de Instant Gaming (EUR, GBP y USD) y carga manual. Se asume
  que no se puede pagar parte con saldo y parte con tarjeta (configurable por
  país). Eneba/Kinguin/Amazon no están implementados.
- **Keys**: `robots.txt` de Instant Gaming prohíbe su búsqueda, que es el único
  listado completo. Las keys se descubren en las categorías permitidas, así que
  la cobertura es muy baja (una decena de juegos). Los países de activación salen de la ficha de cada
  producto (no se adivinan).
- **Impuestos**: solo IVA 21 % sobre tarjeta argentina por defecto. Otras
  percepciones se agregan en `config/impuestos.ts`.
- **Matcheo entre regiones** heurístico: revisar `/admin/estado` y cargar
  overrides para los casos dudosos.
- **Límite de pedidos** del formulario de alertas en memoria (por proceso).
- **Sin Telegram** (era opcional).
- Esquema con `prisma db push` (sin historial de migraciones); ver
  `docs/decisiones.md`.

## Documentación

- [`docs/fuentes.md`](docs/fuentes.md) — endpoints, formatos, límites y riesgos
- [`docs/calculos.md`](docs/calculos.md) — fórmulas
- [`docs/decisiones.md`](docs/decisiones.md) — decisiones tomadas
- [`docs/plan.md`](docs/plan.md) — etapas y qué falta
- [`CLAUDE.md`](CLAUDE.md) — resumen para trabajar en el código

Aviso: PixelPeso no está afiliado a Nintendo ni a las tiendas. Los precios son
orientativos.
