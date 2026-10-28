# Cómo calculamos

Implementación: `src/lib/domain/` (tests en `tests/unit/`).

## Notación

- `P`: precio vigente en la moneda de la eShop. Si hay una oferta activa más
  barata que el precio regular, se usa la oferta.
- `C`: cotización a ARS de DolarAPI, **punta venta** (`config/monedas.ts`).
  Puede ser dólar o euro, oficial o blue.
- `convertir(P)`: lleva `P` a su moneda puente.
  - USD → USD y EUR → EUR (sin conversión).
  - GBP, PLN y otras europeas → EUR; CAD/MXN/BRL → USD (`MONEDA_PUENTE`).
  - La conversión usa Frankfurter con base EUR:
    `monto_puente = monto / cruzada[moneda] × cruzada[puente]` (con `cruzada[EUR] = 1`).
  - ARS no se convierte (`C = 1`). Se contempla por si la eShop argentina
    devuelve pesos.
- `IVA`: 21 %. Qué impuestos se aplican a qué método se define solo en
  `config/impuestos.ts`. Por defecto el IVA solo se aplica a tarjeta argentina.
  Si hay varios impuestos, todos se calculan sobre la misma base (no en cascada).

## Fórmulas

| Método | Fórmula |
|---|---|
| Tarjeta argentina | `ARS = convertir(P) × C × (1 + IVA)` |
| Tarjeta del exterior | `ARS = convertir(P) × C` |
| Gift card | `ARS = Σ (precio de cada tarjeta comprada, convertido a ARS)` (+ impuestos si `gift_card` está en `aplicaA`) |
| Key en Instant Gaming | `ARS = convertir(P_IG) × C` (+ impuestos si `key_ig` está en `aplicaA`) |

Cada fórmula se calcula dos veces: con `C` oficial y con `C` blue.

### Euro blue

Si DolarAPI no publica euro blue en la ruta configurada
(`DOLARAPI_EURO_BLUE_PATH`), se deriva:
`euro_blue = dólar_blue × (USD por EUR de Frankfurter)`. La página de
cotizaciones indica cuando el valor es derivado.

## Región "Europa"

Para cada método y cotización se calcula el costo en cada eShop de la lista
(`config/regiones.ts`, o `EUROPA_PAISES`) y se muestra la más barata, con el
país ganador. Las demás quedan como alternativas: si el usuario dice que solo
tiene cuenta en un país, la recomendación usa ese país.

## Gift cards: combinación óptima

1. Se toman las ofertas de gift cards disponibles cuya región sirve en esa eShop
   (`config/giftcards.ts`) **y** cuya moneda coincide con la moneda del precio.
2. Para cada valor nominal se queda la oferta más barata en ARS.
3. Se resuelve un problema de cobertura de costo mínimo con repetición
   (programación dinámica sobre el valor nominal, en pasos del MCD de las
   denominaciones): costo mínimo para juntar exactamente cada valor `v`, y se
   elige el menor costo con `v ≥ P`.
4. Desempates: menor saldo sobrante; después, menos tarjetas.
5. Se muestran las tarjetas a comprar, el costo total en ARS y el saldo que
   sobra en la cuenta (`v − P`).

**Pago mixto (saldo + tarjeta).** Por defecto se asume que la eShop **no**
permite pagar una parte con saldo y el resto con tarjeta, así que las tarjetas
tienen que cubrir el precio completo. Si un país lo permite
(`PAGO_MIXTO_POR_PAIS`), el optimizador también evalúa combinaciones que no
llegan al precio y suma la diferencia pagada con tarjeta del exterior:
`costo = Σ tarjetas + (P − v) × C (+ impuestos de tarjeta_exterior)`.

## Recomendación

- Se consideran todas las celdas región × método × cotización que el usuario
  puede usar según su perfil (cuentas que tiene, tarjetas, si acepta gift
  cards, keys o marketplaces).
- La más barata es la recomendación.
- El ahorro se mide contra **eShop Argentina + tarjeta argentina con la misma
  cotización** que la opción recomendada:
  `ahorro = ARS_referencia − ARS_recomendada` y
  `ahorro % = ahorro / ARS_referencia × 100`.

## Redondeo

Todos los cálculos usan `decimal.js` con 40 dígitos de precisión. Se redondea
a 2 decimales (half-up) recién al mostrar (`src/lib/formato.ts`).

## Historial

El gráfico de la ficha muestra, por región, `convertir(P) × C` (sin impuestos)
con la cotización guardada para ese mismo día. El "mínimo histórico" es el
menor de esos valores en ARS con cotización oficial.
