"use client";

import React from "react";

// Perfil escolhido no seletor do topo (substitui uma tela de login no projeto acadêmico).
// Fica no localStorage do navegador e vai em toda requisição no header X-Usuario-Id.
// O servidor busca o papel no banco: o front nunca diz "eu sou gerente".
const CHAVE = "delivery:usuarioId";
const EVENTO = "delivery:perfil-trocado";

export function getUsuarioId(): string {
  try {
    return localStorage.getItem(CHAVE) ?? "";
  } catch {
    return "";
  }
}

export function setUsuarioId(id: string) {
  try {
    localStorage.setItem(CHAVE, id);
  } catch {
    // Navegação privada sem storage: o perfil vale só até recarregar
  }
  window.dispatchEvent(new Event(EVENTO));
}

function assinar(callback: () => void) {
  window.addEventListener(EVENTO, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENTO, callback);
    window.removeEventListener("storage", callback);
  };
}

// Componentes que dependem do perfil usam este hook e recarregam quando ele muda
export function useUsuarioId(): string {
  return React.useSyncExternalStore(assinar, getUsuarioId, () => "");
}
