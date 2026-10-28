/**
 * URLs y parámetros de las fuentes externas. Todo se puede pisar por variables
 * de entorno (ver .env.example).
 */

function env(nombre: string, porDefecto: string): string {
  const v = process.env[nombre];
  return v && v.length > 0 ? v : porDefecto;
}

export const fuentes = {
  nintendoPrecios: {
    baseUrl: () => env("NINTENDO_PRICE_API_URL", "https://api.ec.nintendo.com/v1/price"),
    /** Máximo de nsuids por request. 50 según la documentación comunitaria; a verificar. */
    maxIdsPorRequest: () => Number(env("NINTENDO_PRICE_MAX_IDS", "50")),
  },
  nintendoEuropa: {
    baseUrl: () => env("NINTENDO_EU_SEARCH_URL", "https://searching.nintendo-europe.com"),
    filasPorPagina: () => Number(env("NINTENDO_EU_ROWS", "1000")),
  },
  nintendoAmericas: {
    /** Permite apagar el catálogo de América (por ejemplo, si la fuente no está disponible). */
    habilitado: () => env("NINTENDO_AMERICAS_HABILITADO", "1") !== "0",
    appId: () => env("NINTENDO_ALGOLIA_APP_ID", "U3B6GR4UA3"),
    apiKey: () => env("NINTENDO_ALGOLIA_API_KEY", "a29c6927638bfd8cee23993e51e721c9"),
    indice: () => env("NINTENDO_ALGOLIA_INDEX", "store_game_en_us"),
    /** Algolia no deja paginar más allá de este número de resultados por consulta. */
    limitePaginacion: 1000,
  },
  dolarApi: {
    baseUrl: () => env("DOLARAPI_URL", "https://dolarapi.com"),
    rutas: {
      dolarOficial: "/v1/dolares/oficial",
      dolarBlue: "/v1/dolares/blue",
      euroOficial: "/v1/cotizaciones/eur",
      /** Si esta ruta no existe, el euro blue se deriva de dólar blue × EUR/USD (ver docs/calculos.md). */
      euroBlue: () => env("DOLARAPI_EURO_BLUE_PATH", "/v1/cotizaciones/eur/blue"),
    },
  },
  frankfurter: {
    baseUrl: () => env("FRANKFURTER_URL", "https://api.frankfurter.dev/v1"),
  },
  instantGaming: {
    baseUrl: () => env("INSTANT_GAMING_URL", "https://www.instant-gaming.com"),
  },
  scraping: {
    userAgent: () =>
      env(
        "SCRAPER_USER_AGENT",
        "PixelPesoBot/1.0 (+https://github.com/0x0ar/eShop; comparador de precios sin fines de compra)",
      ),
    /** Milisegundos mínimos entre requests al mismo host de scraping. */
    intervaloMinimoMs: () => Number(env("SCRAPER_MIN_INTERVAL_MS", "4000")),
    /** Cuánto se reutiliza una página scrapeada antes de volver a pedirla. */
    ttlCacheMs: () => Number(env("SCRAPER_CACHE_TTL_MS", String(12 * 60 * 60 * 1000))),
  },
  /** Intervalo mínimo entre requests a APIs (no scraping), por host. */
  apiIntervaloMinimoMs: () => Number(env("API_MIN_INTERVAL_MS", "250")),
};
