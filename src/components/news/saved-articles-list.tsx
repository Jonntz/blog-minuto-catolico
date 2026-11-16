"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { obterArtigosSalvos } from "@/app/actions/saved";
import { ArticleCard } from "@/components/article/article-card";
import type { ArtigoCard } from "@/lib/articles";

const CHAVE_SALVOS = "bn-salvos";
const ROTA_ARQUIVO = "/noticias";

function lerSlugsLocal(): string[] {
  try {
    const bruto = localStorage.getItem(CHAVE_SALVOS);
    if (!bruto) return [];
    const lista = JSON.parse(bruto);
    if (!Array.isArray(lista)) return [];
    return lista.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export function SavedArticlesList() {
  const [slugs, setSlugs] = useState<string[] | null>(null);
  const [artigos, setArtigos] = useState<ArtigoCard[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const atuais = lerSlugsLocal();
    setSlugs(atuais);

    if (atuais.length === 0) {
      setCarregando(false);
      return;
    }

    let ativo = true;
    obterArtigosSalvos(atuais)
      .then((res) => {
        if (ativo) setArtigos(res);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, []);

  function remover(slug: string) {
    const novos = (slugs ?? []).filter((s) => s !== slug);
    setSlugs(novos);
    setArtigos((atuais) => atuais.filter((a) => a.slug !== slug));
    try {
      localStorage.setItem(CHAVE_SALVOS, JSON.stringify(novos));
    } catch {
      // Ignora erro em modo privativo
    }
  }

  function limparTudo() {
    setSlugs([]);
    setArtigos([]);
    try {
      localStorage.removeItem(CHAVE_SALVOS);
    } catch {
      // Ignora erro em modo privativo
    }
  }

  if (carregando || slugs === null) {
    return (
      <div
        aria-hidden="true"
        className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-64 rounded-[18px] bg-surface-2" />
        ))}
      </div>
    );
  }

  if (artigos.length === 0) {
    return (
      <div className="mt-8 rounded-[18px] border border-line bg-surface p-8 shadow-card">
        <p className="text-[16px] leading-[1.6] text-ink-2">
          Você ainda não salvou nenhuma matéria neste aparelho. Ao ler uma
          notícia, toque no botão <strong className="text-ink">Salvar</strong>{" "}
          no topo da matéria para guardá-la aqui.
        </p>
        <div className="mt-6">
          <Link
            href={ROTA_ARQUIVO}
            className="inline-flex min-h-11 touch-manipulation items-center rounded-full border border-line bg-surface-2 px-5 text-[14px] font-medium text-ink transition-colors duration-200 ease-dc hover:border-blue-f hover:text-blue-f"
          >
            Explorar todas as notícias →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-2">
          {artigos.length}{" "}
          {artigos.length === 1 ? "matéria salva" : "matérias salvas"} neste
          aparelho
        </p>
        <button
          type="button"
          onClick={limparTudo}
          className="inline-flex min-h-10 touch-manipulation items-center rounded-full border border-line px-4 text-xs font-medium text-ink-3 transition-colors duration-200 hover:border-red-f hover:text-red-f"
        >
          Limpar lista
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {artigos.map((artigo) => (
          <div key={artigo.slug} className="flex flex-col gap-2">
            <ArticleCard artigo={artigo} nivelDoTitulo="h2" />
            <button
              type="button"
              onClick={() => remover(artigo.slug)}
              className="self-end text-xs text-ink-3 underline underline-offset-2 hover:text-red-f"
            >
              Remover dos salvos
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
