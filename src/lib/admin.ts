import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const COOKIE_ADMIN = "pp_admin";

function huella(token: string) {
  return createHash("sha256").update(`pixelpeso-admin:${token}`).digest("hex");
}

export function adminHabilitado(): boolean {
  return Boolean(process.env.ADMIN_TOKEN && process.env.ADMIN_TOKEN.length >= 12);
}

export function tokenValido(token: string): boolean {
  const esperado = process.env.ADMIN_TOKEN;
  if (!esperado || !adminHabilitado()) return false;
  const a = Buffer.from(huella(token));
  const b = Buffer.from(huella(esperado));
  return a.length === b.length && timingSafeEqual(a, b);
}

/** La cookie guarda la huella del token (no el token). */
export async function esAdmin(): Promise<boolean> {
  const esperado = process.env.ADMIN_TOKEN;
  if (!esperado || !adminHabilitado()) return false;
  const valor = (await cookies()).get(COOKIE_ADMIN)?.value ?? "";
  const a = Buffer.from(valor);
  const b = Buffer.from(huella(esperado));
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function iniciarSesionAdmin(token: string): Promise<boolean> {
  if (!tokenValido(token)) return false;
  (await cookies()).set(COOKIE_ADMIN, huella(token), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: 60 * 60 * 8,
  });
  return true;
}

export async function cerrarSesionAdmin() {
  (await cookies()).delete({ name: COOKIE_ADMIN, path: "/admin" });
}
