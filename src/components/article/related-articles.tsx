import type { Article } from "@/db/schema";
import { Reveal } from "@/components/ui/reveal";
import { ArticleCard } from "./article-card";

/**
 * "Leia também" — sempre abaixo da dobra, então cada card entra com o reveal
 * do design. O `delayMs` escalonado é o que transforma três animações
 * simultâneas numa entrada em sequência.
 */
export function RelatedArticles({
  artigos,
}: {
  artigos: readonly Article[];
}) {
  if (artigos.length === 0) return null;

  return (
    <section aria-labelledby="leia-tambem" className="mt-20">
      <h2
        id="leia-tambem"
        className="border-b border-line pb-4 font-display text-[22px] leading-[1.1] font-semibold tracking-[-0.03em]"
      >
        Leia também
      </h2>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {artigos.map((artigo, i) => (
          <Reveal key={artigo.slug} delayMs={i * 70} className="h-full">
            <ArticleCard artigo={artigo} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}
