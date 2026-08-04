"use client";

import { useSyncExternalStore } from "react";

/**
 * Recorte tipado da biblioteca da Adcash e o sinal de "já carregou".
 *
 * ## Por que existe uma store de prontidão
 *
 * O carregador (`adcash.tsx`) mora no layout do site e **não desmonta ao
 * navegar** — em navegação client-side entre a capa e uma matéria, o
 * `<Script>` continua montado e o `onReady` não dispara de novo. Se a chamada
 * de `runBanner` vivesse ali, ela rodaria uma única vez, para os slots que
 * existiam na primeira página carregada, e todo slot alcançado por navegação
 * ficaria vazio para sempre.
 *
 * A inversão resolve: o carregador só avisa que a biblioteca chegou, e cada
 * slot ativa a própria zona quando monta. Mesmo padrão do `consent-store.ts`, e
 * pela mesma razão — dois pontos distantes da árvore precisam do mesmo booleano
 * sem que nada acima deles vire Client Component.
 */

interface Aclib {
  runBanner(opcoes: { zoneId: string; blockId?: string }): void;
}

declare global {
  interface Window {
    aclib?: Aclib;
  }
}

/** `https:` explícito — protocol-relative (`//`) quebra em file:// e em preview. */
export const SRC_ACLIB = "https://acscdn.com/script/aclib.js";
export const ORIGEM_ACLIB = "https://acscdn.com";

let pronto = false;
const inscritos = new Set<() => void>();

/** Chamado pelo `onReady` do `next/script`. Idempotente de propósito. */
export function marcarAclibPronto(): void {
  if (pronto) return;
  pronto = true;
  for (const avisar of inscritos) avisar();
}

function assinar(aoMudar: () => void): () => void {
  inscritos.add(aoMudar);
  return () => {
    inscritos.delete(aoMudar);
  };
}

function snapshot(): boolean {
  return pronto;
}

/** No servidor a biblioteca nunca está carregada, e o HTML é igual para todos. */
function snapshotServidor(): boolean {
  return false;
}

export function useAclibPronto(): boolean {
  return useSyncExternalStore(assinar, snapshot, snapshotServidor);
}

/**
 * Dispara uma zona. Nunca lança: falha de anúncio não pode derrubar a
 * hidratação da página nem interromper os outros slots.
 */
export function rodarBanner(zoneId: string, blockId: string): void {
  const aclib = window.aclib;
  if (!aclib) return;

  try {
    aclib.runBanner({ zoneId, blockId });
  } catch (erro) {
    console.warn(
      JSON.stringify({
        escopo: "ads.adcash",
        evento: "run_banner_falhou",
        zoneId,
        blockId,
        erro: erro instanceof Error ? erro.message : String(erro),
      }),
    );
  }
}
