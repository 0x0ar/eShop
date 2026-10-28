"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { cerrarSesionAdmin, esAdmin, iniciarSesionAdmin } from "@/lib/admin";
import { correrJob } from "@/lib/jobs";
import { limitar } from "@/lib/limite";

const JOBS_DESDE_PANEL = ["cotizaciones", "resumen", "alertas", "rematchear", "limpieza"];

export async function entrar(formData: FormData) {
  if (!limitar("admin-login", 10, 15 * 60 * 1000)) redirect("/admin/estado?error=limite");
  const ok = await iniciarSesionAdmin(String(formData.get("token") ?? ""));
  redirect(ok ? "/admin/estado" : "/admin/estado?error=token");
}

export async function salir() {
  await cerrarSesionAdmin();
  redirect("/admin/estado");
}

export async function correrDesdePanel(formData: FormData) {
  if (!(await esAdmin())) redirect("/admin/estado");
  const job = String(formData.get("job") ?? "");
  if (!JOBS_DESDE_PANEL.includes(job)) throw new Error("Job no permitido desde el panel");
  await correrJob(job);
  revalidatePath("/admin/estado");
}

const NSUID = /^\d{14}$/;

export async function agregarOverride(formData: FormData) {
  if (!(await esAdmin())) redirect("/admin/estado");
  const a = String(formData.get("nsuidAmericas") ?? "").trim() || null;
  const e = String(formData.get("nsuidEuropa") ?? "").trim() || null;
  if ((!a && !e) || (a && !NSUID.test(a)) || (e && !NSUID.test(e))) redirect("/admin/estado?error=nsuid");
  const existente = await db.matchOverride.findFirst({ where: { nsuidAmericas: a, nsuidEuropa: e } });
  if (!existente) {
    await db.matchOverride.create({
      data: { nsuidAmericas: a, nsuidEuropa: e, nota: String(formData.get("nota") ?? "").slice(0, 200) || null },
    });
  }
  await correrJob("rematchear");
  revalidatePath("/admin/estado");
}

export async function borrarOverride(formData: FormData) {
  if (!(await esAdmin())) redirect("/admin/estado");
  await db.matchOverride.delete({ where: { id: String(formData.get("id")) } }).catch(() => null);
  await correrJob("rematchear");
  revalidatePath("/admin/estado");
}
