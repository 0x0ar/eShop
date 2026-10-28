/**
 * Límite de pedidos en memoria (por proceso). Suficiente para frenar abusos
 * básicos del formulario de alertas; detrás de varias instancias conviene un
 * límite en el proxy o en la base.
 */
const ventanas = new Map<string, number[]>();

export function limitar(clave: string, maximo: number, ventanaMs: number): boolean {
  const ahora = Date.now();
  const recientes = (ventanas.get(clave) ?? []).filter((t) => ahora - t < ventanaMs);
  if (recientes.length >= maximo) {
    ventanas.set(clave, recientes);
    return false;
  }
  recientes.push(ahora);
  ventanas.set(clave, recientes);
  if (ventanas.size > 10_000) ventanas.clear();
  return true;
}
