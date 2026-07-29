import Link from "next/link";
import type { Article } from "@/db/schema";
import { getCategoriaOuPadrao } from "@/lib/categories";
import { dataHoraCurta, isoCompleto, minutosDeLeitura } from "@/lib/format";
import { ArticleMedia } from "@/components/ui/article-media";
import { CategoryTag } from "@/components/ui/category-tag";
import { ArticleActions } from "./article-actions";

/**
 * Topo da página de matéria: trilha, título, linha fina, meta e imagem.
 *
 * A imagem daqui é o LCP da página — daí `priority` (CLAUDE.md §5) e as
 * dimensões explícitas com proporção fixa no wrapper, que reservam o espaço
 * antes do download e mantêm o CLS em zero. É o único `priority` do projeto: sair
 * distribuindo a flag anularia o efeito dela.
 */
export function ArticleHeader({ artigo }: { artigo: Article }) {
  const titulo = artigo.title ?? artigo.sourceTitle;
  const categoria = getCategoriaOuPadrao(artigo.categorySlug);
  const minutos = minutosDeLeitura(artigo.bodyMd ?? "");

  return (
    <header>
      <nav aria-label="Trilha de navegação" className="mb-7">
        <ol className="flex flex-wrap items-center gap-2 text-xs tracking-[0.08em] text-ink-3 uppercase">
          <li>
            <Link
              href="/"
              className="transition-colors duration-200 ease-dc hover:text-blue-f"
            >
              Capa
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href={`/categoria/${categoria.slug}`}
              className="transition-colors duration-200 ease-dc hover:text-blue-f"
            >
              {categoria.label}
            </Link>
          </li>
        </ol>
      </nav>

      <CategoryTag slug={artigo.categorySlug} />

      <h1 className="mt-4 max-w-[20ch] font-display text-[36px] leading-[1.02] font-semibold tracking-[-0.035em] break-words text-balance sm:text-[52px]">
        {titulo}
      </h1>

      {artigo.dek ? (
        <p className="mt-5 max-w-[62ch] text-[19px] leading-[1.5] text-ink-2 sm:text-[21px]">
          {artigo.dek}
        </p>
      ) : null}

      {/* Faixa de assinatura do design: metadados à esquerda, ações à direita,
          entre duas linhas. */}
      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3 border-y border-line py-4">
        <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-ink-3">
          <time dateTime={isoCompleto(artigo.publishedAt)}>
            {dataHoraCurta(artigo.publishedAt)}
          </time>
          <span aria-hidden="true">·</span>
          <span>{minutos} min de leitura</span>
          <span aria-hidden="true">·</span>
          <span>
            Fonte:{" "}
            <span className="font-medium text-ink-2">{artigo.sourceName}</span>
          </span>
        </p>

        <ArticleActions titulo={titulo} slug={artigo.slug} />
      </div>

      <figure className="mt-8">
        <ArticleMedia
          src={artigo.imageUrl}
          alt={artigo.imageCaption ?? titulo}
          width={1240}
          height={698}
          priority
          sizes="(min-width: 1280px) 1160px, 100vw"
          className="aspect-[16/9] rounded-[18px]"
        />
        {artigo.imageCaption || artigo.imageCredit ? (
          <figcaption className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-[12px] leading-relaxed text-ink-3">
            {artigo.imageCaption ? <span>{artigo.imageCaption}</span> : null}
            {artigo.imageCredit ? (
              <span className="italic">{artigo.imageCredit}</span>
            ) : null}
          </figcaption>
        ) : null}
      </figure>
    </header>
  );
}
