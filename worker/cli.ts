import "dotenv/config";
import { correrJob, JOBS, SECUENCIA_TODO } from "@/lib/jobs";
import { db } from "@/lib/db";

/**
 * Ejecuta jobs a mano:
 *   npm run job -- --lista
 *   npm run job -- cotizaciones
 *   npm run job -- catalogo precios
 *   npm run job -- todo
 */

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  if (args.length === 0 || args.includes("--lista") || args.includes("--help")) {
    console.log("Jobs disponibles:\n");
    for (const [nombre, def] of Object.entries(JOBS)) {
      console.log(
        `  ${nombre.padEnd(14)} ${def.descripcion}${def.despues ? ` (después: ${def.despues.join(", ")})` : ""}`,
      );
    }
    console.log(`  ${"todo".padEnd(14)} Carga completa: ${SECUENCIA_TODO.join(" → ")}`);
    console.log("\nUso: npm run job -- <nombre> [<nombre>…]");
    return 0;
  }
  let fallos = 0;
  for (const nombre of args) {
    const resultados = await correrJob(nombre);
    for (const r of resultados) {
      console.log(`${r.ok ? "✔" : "✘"} ${r.nombre}: ${r.mensaje}`);
      if (!r.ok) fallos++;
    }
  }
  return fallos > 0 ? 1 : 0;
}

main()
  .then(async (codigo) => {
    await db.$disconnect();
    process.exit(codigo);
  })
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
