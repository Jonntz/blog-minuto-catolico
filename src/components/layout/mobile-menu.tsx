"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
 *
 * ## Por que o painel vai para `document.body` por portal
 *
 * Ele MORAVA dentro do `<header>`, e por isso não abria no celular. O header
 * envolve os filhos numa caixa `backdrop-blur-xl` de 54px de altura, e
 * `backdrop-filter` faz do elemento **bloco contentor de descendentes
 * `position: fixed`** (o mesmo vale para `transform`, `filter` e `perspective`).
 * Resultado: o `fixed inset-x-0 top-[57px] bottom-0` do painel deixava de ser
 * relativo à viewport e passava a ser relativo àquela faixa de 54px — `top:57px`
 * com `bottom:0` numa caixa de 54px dá altura negativa. O painel abria com zero
 * pixel de altura: nada aparecia, e o pouco que vazava ficava atrás do
 * conteúdo.
 *
 * O portal tira o painel dessa cadeia de uma vez. De quebra, o `-translate-y-full`
 * que esconde o header ao rolar deixa de arrastar o menu junto.
 *
 * Consequência aceita: o painel não sai mais no HTML do servidor. Não custa
 * indexação — os mesmos links já estão no `<nav>` de desktop e no rodapé, ambos
 * renderizados no servidor em toda página.
 */
export function MobileMenu({ itens }: { itens: readonly ItemDeNavegacao[] }) {
  const [aberto, setAberto] = useState(false);
  const [montado, setMontado] = useState(false);
  const idPainel = useId();
  const botaoRef = useRef<HTMLButtonElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);

  // `createPortal` precisa de `document`, que não existe no servidor.
  useEffect(() => setMontado(true), []);

  useEffect(() => {
    if (!aberto) return;

    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        setAberto(false);
        botaoRef.current?.focus();
      }
    }

    // A trava vai no <html>, não no <body>. Desde que o `overflow-x: clip` do
    // globals.css entrou, o <html> deixou de ser `visible` — e é justamente essa
    // condição que fazia o `overflow` do <body> propagar para a viewport. Travar
    // o <body> hoje não trava nada: o fundo continuaria rolando atrás do menu.
    const raiz = document.documentElement;
    raiz.style.overflow = "hidden";
    document.addEventListener("keydown", aoTeclar);
    painelRef.current?.querySelector("a")?.focus();

    return () => {
      // Remove a declaração inline em vez de gravar "" — assim o valor volta a
      // ser o da folha de estilo, não um vazio que a sobrescreve.
      raiz.style.removeProperty("overflow");
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  const painel = (
    <div
      id={idPainel}
      ref={painelRef}
      hidden={!aberto}
      // z-40 e não z-50: o painel fica ABAIXO da barra do header de propósito,
      // para o botão de fechar continuar visível e clicável com ele aberto.
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
  );

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

      {montado ? createPortal(painel, document.body) : null}
    </>
  );
}
