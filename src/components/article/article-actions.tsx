"use client";

import { useState } from "react";

const CLASSES_BOTAO =
  "inline-flex min-h-9 items-center rounded-full border border-line px-[13px] text-[12.5px] text-ink-2 transition-colors duration-200 ease-dc hover:border-ink-3 hover:text-ink";

/**
 * Ações de "Compartilhar" e "Salvar" do cabeçalho da matéria.
 *
 * Compartilhar usa a Web Share API quando existe (celular), e cai para copiar
 * o link quando não existe (desktop) — em vez de abrir uma rede social
 * específica, que seria escolher por quem lê.
 *
 * Salvar guarda no `localStorage`. É honesto sobre o que é: uma lista no
 * aparelho, não uma conta. Sem login, prometer sincronização seria mentira.
 */
export function ArticleActions({
  titulo,
  slug,
}: {
  titulo: string;
  slug: string;
}) {
  const [avisoCompartilhar, setAvisoCompartilhar] = useState<string | null>(
    null,
  );
  const [salvo, setSalvo] = useState(false);

  async function compartilhar() {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title: titulo, url });
        return;
      } catch {
        // Usuário cancelou a folha de compartilhamento: não é erro, e não
        // deve virar mensagem na tela.
        return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setAvisoCompartilhar("Link copiado");
      setTimeout(() => setAvisoCompartilhar(null), 2500);
    } catch {
      setAvisoCompartilhar("Não foi possível copiar");
      setTimeout(() => setAvisoCompartilhar(null), 2500);
    }
  }

  function salvar() {
    try {
      const chave = "bn-salvos";
      const atuais = new Set<string>(
        JSON.parse(localStorage.getItem(chave) ?? "[]") as string[],
      );
      if (atuais.has(slug)) {
        atuais.delete(slug);
        setSalvo(false);
      } else {
        atuais.add(slug);
        setSalvo(true);
      }
      localStorage.setItem(chave, JSON.stringify([...atuais]));
    } catch {
      // Modo privativo: a ação simplesmente não persiste. Não vale quebrar
      // a página por causa disso.
    }
  }

  return (
    <div className="flex shrink-0 gap-2">
      <button type="button" onClick={compartilhar} className={CLASSES_BOTAO}>
        Compartilhar
      </button>
      <button
        type="button"
        onClick={salvar}
        aria-pressed={salvo}
        className={CLASSES_BOTAO}
      >
        {salvo ? "Salvo" : "Salvar"}
      </button>
      <span role="status" className="sr-only">
        {avisoCompartilhar ?? ""}
      </span>
    </div>
  );
}
