"use client";

import { useSyncExternalStore } from "react";
import {
  estadoDe,
  gravarConsentimento,
  lerConsentimento,
  limparConsentimento,
  type EstadoConsentimento,
} from "@/lib/consent";

/**
 * Estado compartilhado do consentimento.
 *
 * ## Por que `useSyncExternalStore` e não Context
 *
 * Três componentes precisam do mesmo valor e vivem em pontos distantes da
 * árvore: o banner (rodapé), o carregador de anúncio e o botão de "mudar
 * preferência" dentro de `/privacidade`. Um Provider teria de envolver o layout
 * inteiro e transformaria a casca — hoje um Server Component — em cliente,
 * jogando fora o PPR que a capa depende (`src/app/(site)/page.tsx`).
 *
 * `useSyncExternalStore` resolve com uma fonte externa (`localStorage`) e um
 * `CustomEvent` como canal de notificação: cada consumidor é cliente por conta
 * própria, e nada acima deles precisa ser.
 *
 * ## Por que o snapshot do servidor é "pendente"
 *
 * `localStorage` não existe no servidor. Devolver `"pendente"` no SSR garante
 * que o HTML prerenderizado seja **idêntico para todos** — que é o que mantém a
 * página cacheável na borda (ver a nota em `src/lib/consent.ts`). A decisão
 * real entra depois da hidratação.
 */

const EVENTO = "bn-consentimento-mudou";

/**
 * Cache do snapshot.
 *
 * `getSnapshot` não pode devolver referência nova a cada chamada, senão o React
 * entra em laço infinito de re-render. Como o valor é uma string do union, o
 * cache é trivial: só recalcula quando o evento avisa.
 */
let cache: EstadoConsentimento | null = null;

function assinar(aoMudar: () => void): () => void {
  const manipular = (): void => {
    cache = null;
    aoMudar();
  };

  window.addEventListener(EVENTO, manipular);
  // `storage` cobre a mudança feita em OUTRA aba do mesmo site.
  window.addEventListener("storage", manipular);

  return () => {
    window.removeEventListener(EVENTO, manipular);
    window.removeEventListener("storage", manipular);
  };
}

function snapshotCliente(): EstadoConsentimento {
  if (cache === null) cache = estadoDe(lerConsentimento());
  return cache;
}

/** No servidor ninguém decidiu ainda — e o HTML precisa ser igual para todos. */
function snapshotServidor(): EstadoConsentimento {
  return "pendente";
}

function publicar(): void {
  cache = null;
  window.dispatchEvent(new CustomEvent(EVENTO));
}

export function useConsentimento(): EstadoConsentimento {
  return useSyncExternalStore(assinar, snapshotCliente, snapshotServidor);
}

export function aceitarPublicidade(): void {
  gravarConsentimento(true);
  publicar();
}

export function recusarPublicidade(): void {
  gravarConsentimento(false);
  publicar();
}

/** Volta ao estado "pendente" e faz o banner reaparecer. */
export function reabrirEscolha(): void {
  limparConsentimento();
  publicar();
}
