import type { Metadata } from "next";

export const metadata: Metadata = { title: "Aviso legal y privacidad" };

export default function Legal() {
  return (
    <div className="max-w-3xl space-y-6 text-sm leading-relaxed">
      <h1 className="text-3xl font-extrabold">Aviso legal y privacidad</h1>

      <section className="space-y-2">
        <h2 className="text-xl font-extrabold">Aviso legal</h2>
        <p>
          PixelPeso es un comparador independiente.{" "}
          <strong>No está afiliado, asociado ni respaldado por Nintendo</strong> ni por ninguna de las tiendas que
          aparecen en el sitio. Nintendo, Nintendo Switch, Nintendo eShop y los nombres de los juegos son marcas de sus
          respectivos dueños y se mencionan solo para identificar los productos.
        </p>
        <p>
          PixelPeso no vende nada: compara precios, recomienda y enlaza a la tienda correspondiente. Los precios, las
          cotizaciones y los impuestos son <strong>orientativos</strong>, se obtienen de fuentes públicas y pueden estar
          desactualizados o tener errores. Verificá siempre el precio final en la tienda antes de comprar.
        </p>
        <p>
          Algunas opciones requieren tener cuentas o medios de pago de otros países, o comprar en marketplaces de
          terceros. Revisá los términos de cada tienda y de Nintendo antes de usarlas. Las portadas se muestran
          enlazadas desde la fuente original.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-extrabold">Privacidad</h2>
        <p>
          El único dato personal que guardamos es <strong>el email que dejás para una alerta de precio</strong>, junto
          con el juego, el precio objetivo y las opciones que marcaste. Lo usamos solo para mandarte la confirmación y
          los avisos de esa alerta. No lo compartimos ni lo vendemos.
        </p>
        <p>
          Las alertas requieren confirmación por email (doble opt-in). Cada mail trae un link para darte de baja. Las
          alertas que no se confirman se borran a los 7 días.
        </p>
        <p>
          La wishlist y tus preferencias (“¿Qué tenés?”, tema claro u oscuro) se guardan solo en tu navegador
          (localStorage); no llegan a nuestro servidor salvo que compartas el link de tu wishlist. No usamos cookies de
          seguimiento ni publicidad.
        </p>
        <p>
          Para pedir que borremos tu email, usá el link de baja de cualquier mail o escribinos al remitente de las
          alertas.
        </p>
      </section>
    </div>
  );
}
