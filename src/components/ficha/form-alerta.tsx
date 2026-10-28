"use client";

import { useState } from "react";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { aPerfilUsuario, usePerfil } from "./perfil";

type Estado = { tipo: "inicial" } | { tipo: "enviando" } | { tipo: "ok"; mensaje: string } | { tipo: "error"; mensaje: string };

export function FormAlerta({ juegoId, paisesEuropa, sugerido }: { juegoId: string; paisesEuropa: string[]; sugerido: string | null }) {
  const [perfilUI] = usePerfil();
  const [estado, setEstado] = useState<Estado>({ tipo: "inicial" });

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setEstado({ tipo: "enviando" });
    try {
      const res = await fetch("/api/alertas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          juegoId,
          precioObjetivo: String(form.get("precio") ?? "").replace(/\./g, ""),
          tipoCotizacion: form.get("tipo"),
          perfil: form.get("usarPerfil") ? aPerfilUsuario(perfilUI, paisesEuropa) : null,
          sitio: form.get("sitio"),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "No pudimos crear la alerta");
      setEstado({
        tipo: "ok",
        mensaje:
          json.estado === "activa"
            ? "Actualizamos tu alerta."
            : "¡Listo! Te mandamos un mail para confirmar la alerta. Hasta que no la confirmes no te vamos a escribir.",
      });
    } catch (err) {
      setEstado({ tipo: "error", mensaje: (err as Error).message });
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-3" aria-describedby="alerta-ayuda">
      <p id="alerta-ayuda" className="text-sm text-muted-foreground">
        Te avisamos por email cuando la opción más barata baje del precio que elijas. Solo guardamos tu email, y cada
        mail trae un link para darte de baja.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="alerta-email">Email</Label>
          <Input id="alerta-email" name="email" type="email" required autoComplete="email" placeholder="vos@ejemplo.com" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="alerta-precio">Avisame por debajo de ($)</Label>
          <Input
            id="alerta-precio"
            name="precio"
            inputMode="numeric"
            required
            pattern="[\d.]+(,\d{1,2})?"
            placeholder="Ej: 45000"
            defaultValue={sugerido ?? ""}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="alerta-tipo">Con cotización</Label>
          <Select id="alerta-tipo" name="tipo" defaultValue="oficial" className="w-full">
            <option value="oficial">Oficial</option>
            <option value="blue">Blue</option>
          </Select>
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" name="usarPerfil" defaultChecked className="size-4 accent-[var(--primary)]" />
          Usar lo que marqué en “¿Qué tenés?”
        </label>
      </div>
      {/* Campo trampa para bots: las personas no lo ven. */}
      <input type="text" name="sitio" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <Button type="submit" disabled={estado.tipo === "enviando"}>
        <BellRing aria-hidden="true" /> {estado.tipo === "enviando" ? "Creando…" : "Crear alerta"}
      </Button>
      <p role="status" aria-live="polite" className={estado.tipo === "error" ? "text-sm font-bold text-primary" : "text-sm font-bold text-success"}>
        {estado.tipo === "ok" || estado.tipo === "error" ? estado.mensaje : ""}
      </p>
    </form>
  );
}
