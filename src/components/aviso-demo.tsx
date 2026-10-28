import { connection } from "next/server";
import { hayDatosDemo } from "@/lib/data/juegos";

/** Banda visible cuando la base tiene datos de demostración (npm run db:seed:demo). */
export async function AvisoDemo() {
  await connection();
  let demo = false;
  try {
    demo = await hayDatosDemo();
  } catch {
    return null;
  }
  if (!demo) return null;
  return (
    <div role="status" className="bg-warning-soft text-warning px-4 py-2 text-center text-sm font-bold">
      Modo demostración: los juegos y precios que ves son ficticios (datos de prueba, no reales).
    </div>
  );
}
