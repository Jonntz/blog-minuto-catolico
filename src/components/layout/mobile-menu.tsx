"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { SiteSearch } from "./site-search";
import { ThemeToggle } from "./theme-toggle";

export interface ItemDeNavegacao {
  href: string;
  label: string;
}

/**
 * Menu de navegação para telas estreitas.
 *
 * Recebe os itens como prop em vez de importar `CATEGORIAS`: assim a lista é
 * montada no servidor e o cliente carrega só o comportamento de abrir e fechar,
 * não o módulo de categorias inteiro.
 *
 * O que o design não trazia e foi acrescentado por acessibilidade:
 * `aria-expanded`/`aria-controls` no botão, fechamento por `Escape`, foco
 * devolvido ao botão ao fechar e trava de rolagem do corpo enquanto aberto.
 * Um painel que cobre a tela sem essas quatro coisas prende o usuário de
 * teclado.
 */
export function MobileMenu({ itens }: { itens: readonly ItemDeNavegacao[] }) {
  const [aberto, setAberto] = useState(false);
  const idPainel = useId();
  const botaoRef = useRef<HTMLButtonElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;

    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        setAberto(false);
        botaoRef.current?.focus();
      }
    }

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", aoTeclar);
    painelRef.current?.querySelector("a")?.focus();

    return () => {
      document.body.style.overflow = overflowAnterior;
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  return (
    <>
      <button
        ref={botaoRef}
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-controls={idPainel}
        aria-label={aberto ? "Fechar menu" : "Abrir menu"}
        className="inline-flex size-9 touch-manipulation items-center justify-center rounded-full border border-line bg-surface text-ink-2 transition-colors duration-200 ease-dc hover:border-blue-f hover:text-blue-f md:hidden"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
          className="size-[18px]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        >
          {aberto ? (
            <path d="M6 6l12 12M18 6L6 18" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" />
          )}
        </svg>
      </button>

      <div
        id={idPainel}
        ref={painelRef}
        // `hidden` em vez de desmontar: o HTML dos links fica no documento para
        // os rastreadores, e reabrir não recria nada.
        hidden={!aberto}
        className="fixed inset-x-0 top-[57px] bottom-0 z-40 overflow-y-auto overscroll-contain border-t border-line bg-bg px-4 pt-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] md:hidden"
      >
        <nav aria-label="Navegação principal (celular)">
          <ul className="flex flex-col">
            {itens.map((item) => (
              <li key={item.href} className="border-b border-line">
                <Link
                  href={item.href}
                  onClick={() => setAberto(false)}
                  className={cn(
                    "flex min-h-[52px] items-center font-display text-[19px] font-semibold tracking-[-0.02em]",
                    "transition-colors duration-200 ease-dc hover:text-blue-f",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Linha inferior do menu, como no design: busca ocupando a largura
            disponível e o alternador de tema ao lado. No celular o tema mora
            aqui, não na barra fixa. */}
        <div className="mt-4 flex gap-2.5">
          <SiteSearch variante="mobile" className="min-w-0 flex-1" />
          <ThemeToggle variante="mobile" />
        </div>
      </div>
    </>
  );
}
