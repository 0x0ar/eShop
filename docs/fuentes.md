# Fuentes de datos

> **Estado de verificación (2026-10-28): NINGUNA fuente pudo verificarse desde
> el entorno de desarrollo.** La política de red del entorno respondió 403 a
> todos los hosts de esta página. Los clientes están escritos según el formato
> documentado públicamente por la comunidad y validan cada respuesta con zod
> (si el formato cambió, el job falla con un error claro en lugar de guardar
> basura). Para verificar: `npm run fixtures:capturar` desde una máquina con
> acceso, después `npm test` (corre `tests/parsers/fixtures-reales.test.ts`) y
> completar las líneas marcadas **A verificar**.

Código: `src/lib/sources/`. Todas las URLs se pueden cambiar por variables de
entorno (`config/fuentes.ts`, `.env.example`).

## 1. Precios de la eShop (Nintendo)

- **Endpoint**: `GET https://api.ec.nintendo.com/v1/price?country={CC}&lang={lang}&ids={nsuid,…}`
- **Auth**: ninguna. No es una API oficial pública.
- **Parámetros**: `country` (ISO-2: AR, US, ES, DE…), `lang` (es, en, de…),
  `ids` (nsuids separados por coma).
- **Límite de ids por request**: 50 según la comunidad. Configurable con
  `NINTENDO_PRICE_MAX_IDS`. **A verificar** (el script de captura prueba 51).
- **Respuesta**:
  ```json
  {
    "personalized": false,
    "country": "US",
    "prices": [
      {
        "title_id": 70010000000001,
        "sales_status": "onsale",
        "regular_price": { "amount": "$59.99", "currency": "USD", "raw_value": "59.99" },
        "discount_price": {
          "amount": "$41.99",
          "currency": "USD",
          "raw_value": "41.99",
          "start_datetime": "…",
          "end_datetime": "…"
        }
      },
      { "title_id": 70010000000002, "sales_status": "not_found" }
    ]
  }
  ```
- **Uso**: `raw_value` se parsea con decimal.js; la moneda se toma de
  `currency` (no se asume). Sin `regular_price` = no está a la venta en ese
  país (se quita el precio actual; el historial queda).
- **Moneda de la eShop argentina**: **A verificar** con
  `tests/fixtures/real/precios-AR.json`. El código no asume nada: si viene en
  ARS no convierte; si viene en USD usa el dólar.
- **Rate limit**: no documentado. Usamos 250 ms entre requests al mismo host
  (`API_MIN_INTERVAL_MS`) y reintentos con backoff ante 429/5xx.
- **Riesgos**: API no oficial, puede cambiar o bloquearse sin aviso. Un
  catálogo de ~20 000 productos × 9 países son ~3 500 requests por corrida.

## 2. Catálogo Europa (Nintendo Europa, Solr)

- **Endpoint**: `GET https://searching.nintendo-europe.com/{núcleo}/select?q=*&fq=type:GAME AND nsuid_txt:*&rows=1000&start=0&wt=json&sort=popularity asc`
- Núcleos por idioma: `es`, `de`, `fr`, `it`, `pt`, `nl`, `en` (`config/regiones.ts`).
  El catálogo se baja del núcleo `es` (títulos en español) y de los demás solo
  `title,nsuid_txt,url` para los enlaces por país.
- **Campos usados**: `title`, `type` (GAME/DLC), `nsuid_txt`, `publisher`,
  `playable_on_txt` / `system_names_txt` (HAC = Switch, BEE = Switch 2: **a
  verificar**), `dates_released_dts`, `image_url_sq_s`, `url`, `excerpt`,
  `popularity`.
- **Límites**: `rows` hasta 1000 sin problemas conocidos.
- **Riesgos**: el núcleo polaco no está identificado; se usa `en`. Nintendo
  migró sitios europeos a nintendo.com en 2024; la forma de `url` puede haber
  cambiado.

## 3. Catálogo América (Algolia de nintendo.com)

- **Endpoint**: `POST https://{APP_ID}-dsn.algolia.net/1/indexes/{índice}/query`
  con headers `X-Algolia-Application-Id` y `X-Algolia-API-Key`.
- **Credenciales**: públicas de solo búsqueda, embebidas en nintendo.com
  (`U3B6GR4UA3` / `a29c6927638bfd8cee23993e51e721c9`, índice
  `store_game_en_us`). **A verificar**: pueden rotar; si cambian, se toman del
  JS de nintendo.com y se cargan en `.env`.
- **Cuerpo**: `{"query":"","filters":"platformCode:NINTENDO_SWITCH","numericFilters":["price.finalPrice>=0","price.finalPrice<1000"],"hitsPerPage":500,"page":0}`
- **Límite**: 1000 resultados por consulta (`paginationLimitedTo`). Se parte
  por plataforma y por rangos de precio, recursivamente, hasta que cada parte
  tenga ≤ 1000.
- **Campos usados**: `title`, `nsuid`, `url`, `productImage`,
  `softwarePublisher`, `releaseDate`, `platformCode`, `topLevelCategoryCode`,
  `dlcType`, `description`.
- **Argentina**: comparte nsuid con EE. UU. (**a verificar**); el enlace se arma
  cambiando `/us/` por `/es-ar/` en la URL de nintendo.com.
- **Riesgos**: productos sin `price.finalPrice` quedan fuera del recorrido por
  rangos.

## 4. DolarAPI

- **Endpoints** (base `https://dolarapi.com`):
  - `GET /v1/dolares/oficial`, `GET /v1/dolares/blue`
  - `GET /v1/cotizaciones/eur` (euro oficial)
  - Euro blue: `DOLARAPI_EURO_BLUE_PATH` (default `/v1/cotizaciones/eur/blue`).
    **A verificar** si existe. Si responde 404, se deriva:
    `euro blue = dólar blue × USD/EUR (Frankfurter)` y se marca como derivado.
- **Respuesta**: `{"moneda":"USD","casa":"blue","nombre":"Blue","compra":1000,"venta":1020,"fechaActualizacion":"2026-…Z"}`
- **Uso**: punta `venta`. Se guarda cada lectura (tabla `Cotizacion`) con la
  fecha de la fuente.
- **Límites**: no documentados; el worker la consulta cada 30 minutos.

## 5. Frankfurter

- **Endpoint**: `GET https://api.frankfurter.app/latest?from=EUR&to=USD,GBP,PLN,…`
  (el dominio nuevo es `api.frankfurter.dev/v1`; configurable con `FRANKFURTER_URL`).
- **Respuesta**: `{"amount":1.0,"base":"EUR","date":"2026-10-27","rates":{"USD":1.08,…}}`
- **Uso**: tipos cruzados con base EUR. Datos del BCE, se actualizan una vez
  por día hábil.

## 6. Instant Gaming (scraping)

- **Sin API**. `fetch` + cheerio; Playwright no hace falta mientras el
  listado venga en el HTML.
- **Rutas** (configurables con `INSTANT_GAMING_RUTA_KEYS` y
  `INSTANT_GAMING_RUTA_GIFTCARDS`, **a verificar**):
  - Keys de Switch: `/es/busquedas/?platform%5B%5D=nintendo-switch&page={n}`
  - Gift cards: `/es/busquedas/?q=nintendo+eshop+card&page={n}`
- **Selectores**: centralizados en `SELECTORES` (`src/lib/sources/instantGaming.ts`).
  **A verificar** con `tests/fixtures/real/instant-gaming-*.html`.
- **Región de activación**: se lee del título ("Europe", "North America"…) o,
  si no está, de la página del producto. **Si no se puede confirmar, la key no
  se publica** (no se adivina).
- **Gift cards**: denominación y moneda se extraen del título
  ("Nintendo eShop Card 25 EUR", "£15", "$20 USD").
- **Buenas prácticas**: respeta `robots.txt` (si no se puede leer, no se
  scrapea), 4 s entre requests (`SCRAPER_MIN_INTERVAL_MS`, o el `Crawl-delay`
  si es mayor), User-Agent identificable (`SCRAPER_USER_AGENT`) y caché de 12 h
  en la tabla `HttpCache`.
- **Riesgos**: cambios de HTML, protección anti-bots, términos de uso.

## 7. Otras fuentes de gift cards

Implementadas como proveedores intercambiables (`src/lib/giftcards/`,
interfaz `ProveedorGiftCards`, habilitados con `GIFTCARD_PROVEEDORES`).

| Tienda                                        | Estado                     | Notas                                                                                                         |
| --------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Instant Gaming                                | Implementado (a verificar) | Tienda propia, no marketplace                                                                                 |
| Carga manual (`config/giftcards-manual.json`) | Implementado               | Para cualquier tienda sin datos accesibles. Cada entrada declara si es marketplace                            |
| Eneba                                         | No implementado            | Marketplace. Sin API pública documentada para precios; front con protección anti-bots. Candidato a investigar |
| Kinguin                                       | No implementado            | Marketplace. Tiene API para afiliados (requiere clave)                                                        |
| Amazon (US/ES/UK)                             | No implementado            | Venta a valor nominal; requiere cuenta del país y bloquea scraping. Se puede cargar a mano                    |

No se pudo investigar precios ni accesibilidad de estas tiendas por el bloqueo
de red.

## Fixtures

`npm run fixtures:capturar` guarda en `tests/fixtures/real/`:
catálogo europeo (juegos y DLC), Algolia, precios de AR/US/ES/GB/PL, prueba de
51 ids, DolarAPI (5 endpoints), Frankfurter, robots.txt y listados de Instant
Gaming, más `_capturado.json` con la fecha y el resultado de cada fuente.
