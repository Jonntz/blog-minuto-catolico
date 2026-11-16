"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const CHAVE_SALVOS = "bn-salvos";
const ROTA_SALVOS = "/salvos";

const CLASSES_BOTAO =
  "inline-flex min-h-10 touch-manipulation items-center gap-1.5 rounded-full border border-line px-3.5 text-[12.5px] font-medium text-ink-2 transition-colors duration-200 ease-dc hover:border-ink-3 hover:text-ink";

function lerSlugsSalvos(): Set<string> {
  try {
    const bruto = localStorage.getItem(CHAVE_SALVOS);
    if (!bruto) return new Set();
    const lista = JSON.parse(bruto);
    if (!Array.isArray(lista)) return new Set();
    return new Set(lista.filter((item): item is string => typeof item === "string"));
  } catch {
    return new Set();
  }
}

/**
 * Ações de "Compartilhar", "WhatsApp" e "Salvar" do cabeçalho da matéria.
 *
 * Compartilhar usa a Web Share API quando existe (celular), e cai para copiar
 * o link com feedback visual no próprio botão quando não existe (desktop).
 *
 * Salvar guarda no `localStorage` e sincroniza o estado inicial no `useEffect`
 * para que recarregar uma matéria já salva exiba "Salvo" em vez de desmarcá-la.
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
  const [urlWhatsApp, setUrlWhatsApp] = useState<string>(
    `https://wa.me/?text=${encodeURIComponent(titulo)}`,
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSalvo(lerSlugsSalvos().has(slug));
    const url = `${window.location.origin}/noticia/${slug}?utm_source=whatsapp&utm_medium=social`;
    setUrlWhatsApp(
      `https://wa.me/?text=${encodeURIComponent(`${titulo} — ${url}`)}`,
    );
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [slug, titulo]);

  function anunciarTemporario(texto: string) {
    setAvisoCompartilhar(texto);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setAvisoCompartilhar(null), 2500);
  }

  async function compartilhar() {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title: titulo, url });
        return;
      } catch {
        // Usuário cancelou a folha de compartilhamento: não é erro.
        return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      anunciarTemporario("Link copiado!");
    } catch {
      anunciarTemporario("Não foi possível copiar");
    }
  }

  function salvar() {
    try {
      const atuais = lerSlugsSalvos();
      if (atuais.has(slug)) {
        atuais.delete(slug);
        setSalvo(false);
      } else {
        atuais.add(slug);
        setSalvo(true);
      }
      localStorage.setItem(CHAVE_SALVOS, JSON.stringify([...atuais]));
    } catch {
      // Modo privativo: a ação simplesmente não persiste.
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={compartilhar} className={CLASSES_BOTAO}>
        {avisoCompartilhar ?? "Compartilhar"}
      </button>

      <a
        href={urlWhatsApp}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Compartilhar no WhatsApp (abre em nova aba)"
        className={CLASSES_BOTAO}
      >
        WhatsApp
      </a>

      <button
        type="button"
        onClick={salvar}
        aria-pressed={salvo}
        className={CLASSES_BOTAO}
      >
        {salvo ? "✓ Salvo" : "Salvar"}
      </button>

      {salvo ? (
        <Link
          href={ROTA_SALVOS}
          className="text-xs font-medium text-blue-f underline underline-offset-2 hover:no-underline"
        >
          Ver salvos
        </Link>
      ) : null}

      <span role="status" aria-live="polite" className="sr-only">
        {avisoCompartilhar ?? ""}
      </span>
    </div>
  );
}
