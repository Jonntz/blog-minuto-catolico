import Link from "next/link";
import { CategoryTag } from "@/components/ui/category-tag";
import { ArticleMedia } from "@/components/ui/article-media";
import { Reveal } from "@/components/ui/reveal";
import type { ArtigoCard } from "@/lib/articles";
import { rotaArtigo, tituloArtigo } from "@/lib/seo";

/**
 * Faixa editorial do design — a citação serifada grande sobre `--surface`,
 * com a foto 1:1 ao lado.
 *
 * Alimentada por um artigo real de Opinião. Se não houver nenhum publicado, a
 * seção inteira não é renderizada: uma citação de vitrine num portal de
 * notícias seria conteúdo falso.
 */
export function Editorial({ artigo }: { artigo: ArtigoCard | undefined }) {
  if (!artigo) return null;

  const citacao = artigo.dek?.trim() || artigo.title?.trim();
  if (!citacao) return null;

  const titulo = tituloArtigo(artigo);

  return (
    <section
      id="opiniao"
      aria-labelledby="editorial-titulo"
      className="mt-20 border-y border-line bg-surface"
    >
      <h2 id="editorial-titulo" className="sr-only">
        Opinião
      </h2>
      <Reveal>
        <div className="mx-auto grid max-w-[1240px] grid-cols-1 items-center gap-[clamp(24px,4vw,64px)] px-4 py-[clamp(48px,7vw,96px)] sm:px-10 lg:grid-cols-2">
          <div>
            <CategoryTag slug={artigo.categorySlug} />

            <blockquote className="mt-5 font-serif text-[clamp(24px,3.4vw,40px)] leading-[1.22] font-light tracking-[-0.02em] italic">
              &ldquo;{citacao}&rdquo;
            </blockquote>

            <p className="mt-5 text-[13.5px] text-ink-3">
              {artigo.sourceName}
              {artigo.sourceAuthor ? ` · ${artigo.sourceAuthor}` : ""}
            </p>

            <Link
              href={rotaArtigo(artigo.slug)}
              aria-label={`Ler o texto completo: ${titulo}`}
              className="mt-3 inline-flex min-h-11 touch-manipulation items-center text-sm font-medium text-blue-f transition-opacity duration-200 hover:opacity-80"
            >
              Ler o texto completo
              <span aria-hidden="true" className="ml-1.5">
                →
              </span>
            </Link>
          </div>

          {/* 1:1, como no design. `aspect-square` garante a proporção mesmo
              quando não há imagem e o placeholder hachurado entra em ação. */}
          <div className="w-full justify-self-end lg:max-w-[420px]">
            <ArticleMedia
              src={artigo.imageUrl}
              alt={artigo.imageCaption ?? titulo}
              width={420}
              height={420}
              sizes="(min-width: 1024px) 420px, 100vw"
              className="aspect-square rounded-[20px]"
            />
          </div>
        </div>
      </Reveal>
    </section>
  );
}
