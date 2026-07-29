import Link from "next/link";
import type { Article } from "@/db/schema";
import { dataCurta, dataHoraCurta, isoCompleto } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ArticleMedia } from "@/components/ui/article-media";
import { CategoryTag } from "@/components/ui/category-tag";

export type VarianteDeCard = "destaque" | "padrao" | "lista";

/**
 * O card de notícia do design, em três densidades.
 *
 * Um detalhe do contrato que muda o JSX: em `src/db/schema.ts` os campos
 * `title`, `dek` e `bodyMd` são anuláveis — um artigo ingerido e ainda não
 * adaptado (`status: "draft"`) tem só o original em inglês. Por isso o título
 * cai para `sourceTitle` e o dek some em vez de renderizar vazio. A capa nunca
 * mostra rascunho, mas o componente é usado em listagens e não pode confiar
 * nisso.
 *
 * Padrão de link: um único `<Link>` no título, esticado sobre o card inteiro
 * com `after:absolute after:inset-0`. É o que dá área de clique grande sem
 * criar dois links para o mesmo destino — que é como um leitor de tela leria a
 * alternativa ingênua de embrulhar imagem e título separadamente.
 */
export function ArticleCard({
  artigo,
  variante = "padrao",
  prioridadeDeImagem = false,
  nivelDoTitulo = "h3",
  className,
}: {
  artigo: Article;
  variante?: VarianteDeCard;
  prioridadeDeImagem?: boolean;
  /**
   * `h3` quando o card está sob um `h2` de seção (capa, "Leia também"); `h2`
   * quando é filho direto do `h1` da página (listagem de editoria). Pular de
   * `h1` para `h3` deixa buraco na estrutura para quem navega por cabeçalhos.
   */
  nivelDoTitulo?: "h2" | "h3";
  className?: string;
}) {
  const Titulo = nivelDoTitulo;
  const titulo = artigo.title ?? artigo.sourceTitle;
  const href = `/noticia/${artigo.slug}`;
  const destaque = variante === "destaque";
  const lista = variante === "lista";

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col",
        !lista &&
          "overflow-hidden rounded-[18px] border border-line bg-surface shadow-card transition-colors duration-300 ease-dc hover:border-blue-f",
        lista && "border-b border-line pb-5 last:border-b-0 last:pb-0",
        className,
      )}
    >
      {!lista ? (
        <ArticleMedia
          src={artigo.imageUrl}
          alt={artigo.imageCaption ?? titulo}
          width={destaque ? 1240 : 720}
          height={destaque ? 698 : 450}
          priority={prioridadeDeImagem}
          sizes={
            destaque
              ? "(min-width: 1024px) 780px, 100vw"
              : "(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
          }
          className={cn(
            "rounded-none border-0 border-b",
            destaque ? "aspect-[16/9]" : "aspect-[16/10]",
          )}
        />
      ) : null}

      <div
        className={cn(
          // `min-w-0`: filho de flex não encolhe abaixo do conteúdo por padrão,
          // e sem isso `break-words`/`line-clamp` acima nunca chegam a agir.
          "flex min-w-0 flex-1 flex-col",
          destaque ? "gap-3.5 p-6 sm:p-8" : lista ? "gap-2" : "gap-3 p-5",
        )}
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <CategoryTag slug={artigo.categorySlug} />
          {destaque ? (
            <span className="text-xs tracking-[0.12em] text-ink-3 uppercase">
              {artigo.sourceName}
            </span>
          ) : null}
        </div>

        <Titulo
          className={cn(
            // `break-words`: os títulos vêm de fonte externa e podem conter URL
            // ou palavra composta longa. Sem isso um único token estoura a
            // coluna da grade e empurra o card inteiro.
            "font-display font-semibold tracking-[-0.03em] break-words text-balance",
            destaque
              ? "text-[30px] leading-[1.04] sm:text-[40px]"
              : lista
                ? "text-[16px] leading-[1.24]"
                : "text-[20px] leading-[1.16]",
          )}
        >
          <Link
            href={href}
            className="transition-colors duration-200 ease-dc after:absolute after:inset-0 group-hover:text-blue-f"
          >
            {titulo}
          </Link>
        </Titulo>

        {artigo.dek && !lista ? (
          <p
            className={cn(
              "text-ink-2",
              destaque
                ? "max-w-[62ch] text-[17px] leading-[1.55]"
                : // Corta em 3 linhas: os deks vêm de fontes diferentes e variam
                  // de 90 a 400 caracteres. Sem o limite, um card alto desalinha
                  // a linha inteira da grade.
                  "line-clamp-3 text-[14px] leading-[1.55]",
            )}
          >
            {artigo.dek}
          </p>
        ) : null}

        <p
          className={cn(
            "mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3",
            destaque ? "pt-1.5" : "pt-1",
          )}
        >
          <time dateTime={isoCompleto(artigo.publishedAt)}>
            {destaque
              ? dataHoraCurta(artigo.publishedAt)
              : dataCurta(artigo.publishedAt)}
          </time>
          {!destaque ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{artigo.sourceName}</span>
            </>
          ) : null}
        </p>
      </div>
    </article>
  );
}
