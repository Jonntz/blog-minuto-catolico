"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

/** Mesma chave lida pelo script anti-FOUC de `src/app/layout.tsx`. */
const CHAVE_TEMA = "bn-theme";

let temporizadorTransicao: ReturnType<typeof setTimeout> | null = null;
const ouvintes = new Set<() => void>();

function inscreverTema(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

function lerTemaCliente(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function lerTemaServidor(): "light" | "dark" {
  return "light";
}

function aplicar(tema: "light" | "dark") {
  const raiz = document.documentElement;
  raiz.dataset.themeSwitching = "";
  raiz.dataset.theme = tema;
  raiz.style.colorScheme = tema;

  if (temporizadorTransicao) clearTimeout(temporizadorTransicao);
  temporizadorTransicao = setTimeout(() => {
    delete raiz.dataset.themeSwitching;
    temporizadorTransicao = null;
  }, 400);

  try {
    localStorage.setItem(CHAVE_TEMA, tema);
  } catch {
    // Modo privativo ou storage cheio: o tema vale para esta sessão e pronto.
    // Falhar aqui não pode derrubar a troca visual, que já aconteceu acima.
  }

  for (const ouvinte of ouvintes) ouvinte();
}

/**
 * Alternador de tema — a pílula de dois botões do design.
 *
 * O `<html>` já chega do servidor com `data-theme` aplicado pelo script inline
 * do layout, e a variante `dark` do Tailwind (`@custom-variant dark` em
 * globals.css) lê justamente esse atributo. Quem decide a posição do indicador
 * e a cor de cada ícone é o CSS, enquanto `useSyncExternalStore` mantém o
 * `aria-pressed` verdadeiro para leitores de tela.
 */
export function ThemeToggle({
  variante = "desktop",
}: {
  variante?: "desktop" | "mobile";
}) {
  const temaAtivo = useSyncExternalStore(
    inscreverTema,
    lerTemaCliente,
    lerTemaServidor,
  );

  // No celular o design não mostra a pílula: mostra um único botão quadrado
  // dentro do menu aberto, que alterna.
  if (variante === "mobile") {
    return (
      <button
        type="button"
        onClick={() => aplicar(temaAtivo === "dark" ? "light" : "dark")}
        aria-label="Alternar para tema escuro"
        aria-pressed={temaAtivo === "dark"}
        title="Alternar tema"
        className="inline-flex min-h-[46px] w-14 shrink-0 touch-manipulation items-center justify-center rounded-xl border border-line bg-surface-2 text-ink transition-colors duration-200 ease-dc"
      >
        <IconeSol className="size-[19px] dark:hidden" />
        <IconeLua className="hidden size-[19px] dark:block" />
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label="Tema de cores"
      className="relative flex items-center rounded-full border border-line bg-surface-2 p-[3px]"
    >
      {/* Indicador deslizante. `dark:translate-x-full` reproduz o `thumbX` do
          design sem depender da hidratação para pintar a posição certa. */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute top-[3px] left-[3px] h-[calc(100%-6px)] w-[calc(50%-3px)]",
          "rounded-full bg-surface shadow-[0_1px_2px_oklch(0_0_0/0.12)]",
          "transition-transform duration-[380ms] ease-dc",
          "translate-x-0 dark:translate-x-full",
        )}
      />
      <button
        type="button"
        onClick={() => aplicar("light")}
        aria-label="Tema claro"
        aria-pressed={temaAtivo === "light"}
        title="Tema claro"
        className="relative z-10 flex h-7 w-9 touch-manipulation items-center justify-center rounded-full text-ink transition-colors duration-200 ease-dc dark:text-ink-3"
      >
        <IconeSol className="size-[15px]" />
      </button>
      <button
        type="button"
        onClick={() => aplicar("dark")}
        aria-label="Tema escuro"
        aria-pressed={temaAtivo === "dark"}
        title="Tema escuro"
        className="relative z-10 flex h-7 w-9 touch-manipulation items-center justify-center rounded-full text-ink-3 transition-colors duration-200 ease-dc dark:text-ink"
      >
        <IconeLua className="size-[15px]" />
      </button>
    </div>
  );
}

function IconeSol({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.6v2M12 19.4v2M2.6 12h2M19.4 12h2M5.4 5.4l1.4 1.4M17.2 17.2l1.4 1.4M17.2 6.8l1.4-1.4M5.4 18.6l1.4-1.4" />
    </svg>
  );
}

function IconeLua({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.2 15.1A8.6 8.6 0 0 1 8.9 3.8A8.6 8.6 0 1 0 20.2 15.1Z" />
    </svg>
  );
}
