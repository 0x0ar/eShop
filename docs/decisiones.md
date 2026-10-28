# Decisiones

Decisiones tomadas ante ambigüedades del pedido. Cada una indica cómo cambiarla.

## Producto

- **Nombre y marca propios: "PixelPeso".** Logo SVG propio (moneda con un
  píxel). Tipografía Nunito (licencia OFL, vía `@fontsource`, sin pedir a Google
  Fonts en el build). Rojo como color principal sin copiar el de Nintendo.
- **Telegram queda fuera** (era opcional). Las alertas son solo por email; el
  diseño de `src/lib/alertas/` deja lugar para otro canal.

## Datos y cálculos

- **Punta "venta"** de DolarAPI para convertir: quien compra afuera tiene que
  comprar la divisa. Se cambia en `config/monedas.ts`.
- **Moneda puente**: USD y monedas americanas → dólar; EUR, GBP, PLN y demás
  europeas → euro. Es lo más cercano a cómo se paga en la práctica.
- **Moneda de la eShop argentina: no se asume.** La moneda se lee de la
  respuesta de la API de precios (`regular_price.currency`). Si viniera en ARS,
  no se convierte.
- **Catálogos regionales**: EE. UU. y Argentina comparten nsuid (catálogo
  "América"); España y el resto de Europa comparten nsuid (catálogo "Europa").
  El matcheo solo hace falta entre esos dos catálogos. A verificar con fixtures.
- **Matcheo**: puntaje = 65 % título (Dice sobre bigramas del título
  normalizado), 20 % editor, 15 % fecha; exige misma plataforma y tipo
  compatible. Umbral 0,8 y margen 0,04 contra el segundo candidato; lo ambiguo
  no se adivina, se registra en "sin matcheo". Overrides manuales en la tabla
  `MatchOverride` (editable desde `/admin/estado`) y en
  `config/match-overrides.json` (versionado).
- **Pago mixto saldo + tarjeta**: deshabilitado por defecto (las gift cards
  deben cubrir todo). No pudimos verificarlo para cada eShop. Se habilita por
  país en `config/giftcards.ts`.
- **Validez regional de gift cards**: las tarjetas en EUR se asumen canjeables
  en las eShops de la zona euro listadas en `REGIONES_GIFTCARD.EU`. GBP solo en
  GB, USD solo en US. Polonia no tiene tarjetas configuradas. A verificar.
- **IVA en gift cards y keys**: no se aplica por defecto (como pide el
  enunciado). Si se pagan con tarjeta argentina, se agrega el método en
  `config/impuestos.ts`.
- **Tarjeta argentina en eShops extranjeras**: se calcula igual (el enunciado
  pide los 4 métodos en las 4 regiones), con un requisito que advierte que
  suelen rechazarla.
- **Región "Europa"**: el ganador se elige por método y cotización; el resto de
  los países se guarda como alternativa para respetar el perfil del usuario.
- **Historial**: un snapshot por producto, país y día (el último del día gana).
  Las cotizaciones se guardan en cada actualización.
- **Resumen precalculado**: el worker guarda en cada juego el mejor costo en ARS
  (perfil completo) para poder filtrar y ordenar la búsqueda por precio sin
  recalcular todo.

## Técnicas

- **Next.js 16 con Cache Components** (default actual). Las lecturas de base van
  en componentes dentro de `<Suspense>` que llaman `connection()`; así el build
  no necesita base de datos.
- **Prisma 7 con driver adapters**: `better-sqlite3` en local y `pg` en
  producción. El schema es uno solo (`prisma/schema.prisma`, provider sqlite);
  `prisma.config.ts` genera `prisma/postgres/schema.prisma` cambiando el provider
  cuando `DATABASE_URL` es Postgres. No se usan atributos nativos (`@db.*`) para
  que el schema sirva en ambos. Montos con tipo `Decimal`.
- **`prisma db push` en lugar de migraciones**: con un único schema para dos
  motores, mantener dos historiales de migraciones agrega más riesgo que valor
  en esta etapa. Para producción con datos valiosos conviene pasar a
  `prisma migrate` con un historial solo para Postgres.
- **Búsqueda**: Fuse.js en memoria del servidor sobre un índice liviano
  (id, título normalizado, plataforma, tipo, oferta, precio) que se refresca
  cada 10 minutos. Alcanza para decenas de miles de productos y funciona igual
  en SQLite y Postgres.
- **Scraping**: `fetch` + cheerio. Playwright no se usa en producción (no hizo
  falta); si Instant Gaming empezara a requerir JS, iría solo en el worker.
- **Caché HTTP** del scraping en la tabla `HttpCache` (TTL configurable), con
  `robots.txt` respetado y rate limit por host.
- **Admin**: `/admin/estado` se protege con `ADMIN_TOKEN` (cookie httpOnly tras
  ingresar el token). Si la variable no está definida, la página queda
  deshabilitada.
- **Cron en Vercel**: `/api/cron/[job]` con `Authorization: Bearer CRON_SECRET`.
- **Datos de demostración** (`npm run db:seed:demo`): solo para desarrollo local y
  el test e2e. Están marcados con `origen = "demo"`, el sitio muestra un aviso
  cuando hay datos de demo y el seed se niega a correr con `NODE_ENV=production`.

- **shadcn/ui escrito a mano**: el CLI de shadcn necesita bajar el registro y
  la red del entorno no lo permitía. Los componentes de `src/components/ui`
  siguen sus convenciones (cva + `cn` + radix) y `components.json` queda listo
  para sumar más con `npx shadcn add`.
- **SQLite como dependencia opcional**: `better-sqlite3` se compila nativo; para
  que la imagen Docker (Postgres) no necesite toolchain, el adapter de SQLite
  está en `optionalDependencies` y se carga solo si `DATABASE_URL` es `file:`.
- **Docker**: una sola imagen para app, worker y el paso `esquema`
  (`prisma db push`). Se mantiene `node_modules` completo en la imagen porque el
  worker corre con `tsx` sobre el código fuente; es más grande pero evita un
  segundo build. Se probó `docker compose up` desde cero con Postgres el
  2026-10-28.
- **Confirmación y baja con botón** (POST), no con solo abrir el link: los
  antivirus de correo abren links y confirmarían alertas solos. La baja
  one-click (RFC 8058) va por `POST /api/alertas/baja`.
- **Reaviso de alertas**: se avisa al cruzar el objetivo y de nuevo solo si
  pasan 7 días o el precio baja más de 2 % respecto del último aviso.

## Pendiente de verificar (bloqueado)

El 2026-10-28 la red del entorno de desarrollo rechazó (403 de la política de
salida) todas las fuentes: `api.ec.nintendo.com`,
`searching.nintendo-europe.com`, `dolarapi.com`, `api.frankfurter.app`,
`www.instant-gaming.com` y el Algolia de nintendo.com. Los clientes y parsers
están escritos según el formato documentado públicamente por la comunidad y
validan la respuesta con zod; hay que confirmarlos con fixtures reales
(`docs/plan.md`, etapa 5).
