# Fuentes de datos

Código: `src/lib/sources/`. Todas las URLs se pueden cambiar por variables de
entorno (`config/fuentes.ts`, `.env.example`). Las respuestas reales están en
`tests/fixtures/real/` y las prueba `tests/parsers/fixtures-reales.test.ts`.

## Estado de verificación (2026-10-28)

| Fuente                         | Estado                        | Notas                                                                 |
| ------------------------------ | ----------------------------- | --------------------------------------------------------------------- |
| Precios de la eShop (Nintendo) | **Verificada** (ES, GB, PL)   | AR y US sin probar: falta el catálogo de América para tener sus nsuid |
| Catálogo Europa (Solr)         | **Verificada**                | `popularity` viene vacío: se usa `downloads_rank_i`                   |
| Catálogo América (Algolia)     | **Sin verificar — bloqueada** | Ver sección 3                                                         |
| DolarAPI                       | **Verificada**                | No publica euro blue (404): se deriva                                 |
| Frankfurter                    | **Verificada**                | Se mudó a `api.frankfurter.dev/v1` (el dominio viejo redirige)        |
| Instant Gaming                 | **Verificada, con límites**   | robots.txt prohíbe la búsqueda: cobertura de keys parcial (sección 6) |

## 1. Precios de la eShop (Nintendo)

- **Endpoint**: `GET https://api.ec.nintendo.com/v1/price?country={CC}&lang={lang}&ids={nsuid,…}`
- **Auth**: ninguna. No es una API oficial pública. Sin `robots.txt` (404).
- **Límite de ids por request**: **50, verificado** (con 51 responde HTTP 400
  `{"error":{"code":4004,"message":"Bad request: Over ids limit number"}}`).
- **Respuesta real** (recortada, `precios-ES.json`):
  ```json
  {
    "personalized": false,
    "country": "ES",
    "prices": [
      {
        "title_id": 70010000125146,
        "sales_status": "onsale",
        "regular_price": { "amount": "49,99 €", "currency": "EUR", "raw_value": "49.99" },
        "gold_point": { "…": "…" }
      }
    ]
  }
  ```
  Con oferta trae además `discount_price` con `raw_value`, `start_datetime` y
  `end_datetime`. Estados vistos: `onsale`, `preorder`, `unreleased`. Los
  productos sin precio en ese país no traen `regular_price`.
- **Monedas verificadas**: ES → EUR, GB → GBP, PL → PLN. Hay productos
  gratuitos con `raw_value: "0"` (se muestran como gratis, sin gift cards).
- **Moneda de la eShop argentina**: **sin verificar** (hace falta un nsuid del
  catálogo de América). El código no asume nada: toma `currency` de la
  respuesta; si viniera ARS no convierte.
- **Rate limit**: no documentado. Usamos 250 ms entre requests al mismo host
  (`API_MIN_INTERVAL_MS`) y reintentos con backoff ante 429/5xx.
- **Riesgos**: API no oficial, puede cambiar o bloquearse sin aviso.

## 2. Catálogo Europa (Nintendo Europa, Solr)

- **Endpoint**: `GET https://searching.nintendo-europe.com/{núcleo}/select?q=*&fq=type:GAME AND nsuid_txt:*&sort=def(downloads_rank_i,999999) asc&rows=1000&start=0&wt=json`
- **Tamaño verificado**: ~19 900 juegos (`type:GAME`) y ~10 400 DLC (`type:DLC`).
- Núcleos por idioma: `es`, `de`, `fr`, `it`, `pt`, `nl`, `en`. El catálogo se
  baja del núcleo `es`; de los demás solo `title,nsuid_txt,url` para enlazar a
  la eShop de cada país.
- **Campos usados (verificados)**: `title`, `type`, `nsuid_txt`, `publisher`,
  `playable_on_txt` (**`HAC` = Switch, `BEE` = Switch 2**, verificado junto con
  `system_names_txt`), `dates_released_dts`, `image_url_sq_s` (URL absoluta),
  `url` (relativa: `/es-es/Juegos/…html`), `excerpt`, `downloads_rank_i`.
- **Popularidad**: el campo `popularity` viene vacío. Se usa
  `downloads_rank_i` (1 = más descargado, 999999 = sin ranking); para ordenar
  se usa `def(downloads_rank_i,999999) asc` así los que no tienen ranking van
  al final.
- **robots.txt**: el host responde 403 a `/robots.txt`; es una API de búsqueda
  pública que usa el propio sitio de Nintendo.
- **Riesgos**: el núcleo polaco no está identificado; se usa `en`.

## 3. Catálogo América (Algolia de nintendo.com) — BLOQUEADA

- **Endpoint**: `POST https://{APP_ID}-dsn.algolia.net/1/indexes/{índice}/query`
  con headers `X-Algolia-Application-Id` y `X-Algolia-API-Key` (credenciales
  de solo búsqueda embebidas en nintendo.com).
- **Lo que se verificó**: el índice `store_game_en_us` responde. El filtro
  `platformCode:…` que usaba el código **no existe** (0 resultados); los hits
  traen otros campos (`categoryIds`, `availability`, `collectionPriceRange`,
  `contentRating`…). Hay que reescribir `src/lib/sources/nintendo/americas.ts`
  con un hit real.
- **Por qué está bloqueada**: el sistema de permisos del entorno de
  desarrollo no dejó seguir usando la clave de búsqueda de Nintendo (es una
  credencial de un tercero). Es una decisión del dueño del proyecto (ver
  README, "Pendientes").
- **Alternativas evaluadas**: el sitemap de la tienda de EE. UU.
  (`/us/store/sitemap.xml`) lista productos y `robots.txt` permite el
  User-Agent genérico, pero **nintendo.com bloquea explícitamente a los
  agentes de Claude** (`Claude-Web`, `Claudebot`: `Disallow: /`), así que no
  se desarrolló ni probó desde acá.
- Mientras tanto se puede apagar con `NINTENDO_AMERICAS_HABILITADO=0`: el sitio
  funciona con España y Europa, y Argentina/EE. UU. muestran "sin datos".

## 4. DolarAPI

- **Endpoints verificados** (base `https://dolarapi.com`, robots permite todo):
  - `GET /v1/dolares/oficial`, `GET /v1/dolares/blue`
  - `GET /v1/cotizaciones/eur` (euro oficial)
  - `GET /v1/cotizaciones` (lista: USD, EUR, BRL, CLP, UYU… solo oficiales)
- **Euro blue: no existe** (`/v1/cotizaciones/eur/blue` → 404). Se deriva
  `euro blue = dólar blue × USD por EUR (Frankfurter)` y se marca "Derivado".
- **Respuesta real**: `{"moneda":"USD","casa":"oficial","nombre":"Oficial","compra":1510,"venta":1560,"fechaActualizacion":"2026-10-28T11:00:00.000Z"}`
- **Uso**: punta `venta`; se guarda cada lectura con la fecha de la fuente.

## 5. Frankfurter

- **Endpoint verificado**: `GET https://api.frankfurter.dev/v1/latest?from=EUR&to=USD,GBP,PLN,…`
  (`api.frankfurter.app` responde 301 al dominio nuevo). robots permite todo.
- **Respuesta real**: `{"amount":1,"base":"EUR","date":"2026-10-28","rates":{"GBP":0.83785,"PLN":4.4045,"USD":1.1133}}`
- Datos del BCE, una vez por día hábil.

## 6. Instant Gaming (scraping)

Verificado contra el sitio real (`www.instant-gaming.com`, tienda en español,
precios en EUR).

- **robots.txt prohíbe la búsqueda** (`/es/busquedas/` y equivalentes en otros
  idiomas). Es el único lugar con el listado completo (lo arma el navegador
  consultando el Algolia propio de la tienda), así que **no se usa**.
- **Permitido y usado**:
  - Categorías: `/es/nintendo/switch/`, `/es/nintendo/switch2/`,
    `/es/nintendo/tendencias/`, `/es/nintendo/mas-vendidos/` y los géneros que
    enlazan (`/es/nintendo/generos/…`). Traen en el HTML solo productos
    destacados: sirven para **descubrir** fichas.
  - Fichas de producto `/es/{id}-comprar-{slug}/`: traen
    `window.productModel` (`price`, `has_stock`, `retail_currency_format`) y
    **`window.countriesAvailability`** (lista de países donde se activa, en
    español). Con eso se guardan los países exactos de activación de cada
    key: no se adivina la región.
  - Gift cards: se parte de `/es/nintendo/tarjetas-regalo/` y se siguen las
    variantes que enlaza cada ficha. **Instant Gaming vende tarjetas de EE. UU.
    (10, 20, 35 y 50 USD) y Reino Unido (25 GBP); no vende tarjetas en EUR.**
- **Cobertura de keys**: parcial (solo lo que aparece en categorías). Se
  configura con `INSTANT_GAMING_CATEGORIAS` e `INSTANT_GAMING_MAX_PRODUCTOS`.
- **Buenas prácticas**: robots.txt verificado en cada host (si no se puede
  leer, no se scrapea), 4 s entre requests, User-Agent identificable y caché
  de 12 h. Las fixtures se guardan con claves y tokens embebidos redactados.
- **Cloudflare**: con `curl` responde 403; con el `fetch` de Node pasa. Puede
  cambiar en cualquier momento.

## 7. Otras fuentes de gift cards

Proveedores intercambiables (`src/lib/giftcards/`, interfaz
`ProveedorGiftCards`, habilitados con `GIFTCARD_PROVEEDORES`).

| Tienda                                        | Estado         | Notas                                                                              |
| --------------------------------------------- | -------------- | ---------------------------------------------------------------------------------- |
| Instant Gaming                                | Verificado     | Tarjetas USD y GBP                                                                 |
| Carga manual (`config/giftcards-manual.json`) | Implementado   | Para cualquier tienda sin datos accesibles. Cada entrada declara si es marketplace |
| Eneba, Kinguin, Amazon                        | Sin investigar | Quedan como candidatos (marketplaces / venta a valor nominal)                      |

Como Instant Gaming no vende tarjetas en EUR, **España y la región Europa no
tienen opción de gift card** salvo que se carguen ofertas a mano.

## Fixtures

`npm run fixtures:capturar` guarda en `tests/fixtures/real/`: catálogo europeo
(juegos y DLC), precios de ES/GB/PL (AR/US cuando haya catálogo de América),
prueba de 51 ids, DolarAPI (5 endpoints), Frankfurter, robots.txt, una
categoría, la página de tarjetas regalo y una ficha de key y de gift card de
Instant Gaming (solo rutas permitidas por robots), más `_capturado.json`.
