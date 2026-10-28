"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { PerfilUsuario } from "@/lib/domain/tipos";

/**
 * Lo que tiene el usuario (cuentas, tarjetas, si acepta gift cards/keys/marketplaces).
 * Se guarda en localStorage para que valga en todas las fichas.
 */
export interface PerfilUI {
  cuentaAR: boolean;
  cuentaES: boolean;
  cuentaUS: boolean;
  cuentaEU: boolean;
  tarjetaArgentina: boolean;
  tarjetaExterior: boolean;
  giftCards: boolean;
  marketplaces: boolean;
  keys: boolean;
}

export const PERFIL_UI_COMPLETO: PerfilUI = {
  cuentaAR: true,
  cuentaES: true,
  cuentaUS: true,
  cuentaEU: true,
  tarjetaArgentina: true,
  tarjetaExterior: true,
  giftCards: true,
  marketplaces: true,
  keys: true,
};

const CLAVE = "pixelpeso:perfil";
const EVENTO = "pixelpeso:perfil";
let cache: { crudo: string | null; perfil: PerfilUI } = { crudo: null, perfil: PERFIL_UI_COMPLETO };

function leer(): PerfilUI {
  let crudo: string | null = null;
  try {
    crudo = localStorage.getItem(CLAVE);
  } catch {
    return PERFIL_UI_COMPLETO;
  }
  if (crudo === cache.crudo) return cache.perfil;
  let perfil = PERFIL_UI_COMPLETO;
  try {
    const p = JSON.parse(crudo ?? "null");
    if (p && typeof p === "object") {
      perfil = { ...PERFIL_UI_COMPLETO };
      for (const k of Object.keys(PERFIL_UI_COMPLETO) as (keyof PerfilUI)[]) {
        if (typeof p[k] === "boolean") perfil[k] = p[k];
      }
    }
  } catch {
    perfil = PERFIL_UI_COMPLETO;
  }
  cache = { crudo, perfil };
  return perfil;
}

function suscribir(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENTO, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENTO, cb);
  };
}

export function usePerfil(): [PerfilUI, (p: PerfilUI) => void] {
  const perfil = useSyncExternalStore(suscribir, leer, () => PERFIL_UI_COMPLETO);
  const cambiar = useCallback((p: PerfilUI) => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(p));
    } catch {
      // sin almacenamiento: el cambio dura hasta recargar
      cache = { crudo: JSON.stringify(p), perfil: p };
    }
    window.dispatchEvent(new Event(EVENTO));
  }, []);
  return [perfil, cambiar];
}

/** Convierte el perfil de la UI al del dominio. */
export function aPerfilUsuario(p: PerfilUI, paisesEuropa: string[]): PerfilUsuario {
  const todas = p.cuentaAR && p.cuentaES && p.cuentaUS && p.cuentaEU;
  const cuentas = todas
    ? null
    : [...(p.cuentaAR ? ["AR"] : []), ...(p.cuentaES ? ["ES"] : []), ...(p.cuentaUS ? ["US"] : []), ...(p.cuentaEU ? paisesEuropa : [])];
  return {
    cuentas,
    tarjetaArgentina: p.tarjetaArgentina,
    tarjetaExterior: p.tarjetaExterior,
    giftCards: p.giftCards,
    marketplaces: p.marketplaces,
    keys: p.keys,
  };
}
