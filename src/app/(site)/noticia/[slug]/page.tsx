import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdSlot } from "@/components/ads/ad-slot";
import { ArticleBody } from "@/components/article/article-body";
import { ArticleHeader } from "@/components/article/article-header";
import { RelatedArticles } from "@/components/article/related-articles";
import { SourceNote } from "@/components/article/source-note";
import { ArtigoJsonLd } from "@/components/seo/json-ld";
import { Container } from "@/components/ui/container";
import { buscarPorSlug, listarRelacionados } from "@/lib/articles";
import { metadataArtigo, metadataNaoEncontrado } from "@/lib/seo";

interface Props {
  /** No Next 16 `params` é Promise — sempre `await` (CLAUDE.md §5). */
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const artigo = await buscarPorSlug(slug);
  if (!artigo) return metadataNaoEncontrado();
  return metadataArtigo(artigo);
}

/**
 * Página de matéria.
 *
 * Todo o conteúdo depende do D1, então vive dentro de `<Suspense>`: o binding
 * não existe em tempo de build, e o Partial Prerendering serve a casca na hora
 * e streama o resto. Ver a nota em `src/app/(site)/page.tsx`.
 */
export default function ArticlePage({ params }: Props) {
  // `params` NÃO é awaited aqui: sob Cache Components ele é dado de requisição
  // não cacheado, e consumi-lo no corpo da página torna a rota bloqueante.
  return (
    <Container as="article" className="py-12 sm:py-16">
      {/* max-w-[760px] é a medida de leitura: com a serifada em 19px dá algo
          entre 68 e 75 caracteres por linha, que é onde o olho não se perde ao
          voltar para a linha seguinte. */}
      <div className="mx-auto max-w-[760px]">
        <Suspense fallback={<MateriaSkeleton />}>
          <Materia params={params} />
        </Suspense>
      </div>
    </Container>
  );
}

async function Materia({ params }: Props) {
  const { slug } = await params;
  const artigo = await buscarPorSlug(slug);
  if (!artigo) notFound();

  const relacionados = await listarRelacionados(artigo);

  return (
    <>
      {/* NewsArticle + BreadcrumbList. Declara `isBasedOn`/`citation` apontando
          para o original — a atribuição legível fica no SourceNote abaixo. */}
      <ArtigoJsonLd artigo={artigo} />

      <ArticleHeader artigo={artigo} />

      <div className="mt-10">
        {artigo.bodyMd ? (
          <ArticleBody markdown={artigo.bodyMd} />
        ) : (
          // Estado real: artigo ingerido e ainda não adaptado (a quota de IA
          // do dia acabou). O leitor precisa entender por que a página está
          // curta, em vez de encontrar um vazio sem explicação.
          <p className="text-[17px] leading-[1.6] text-ink-2">
            Esta matéria ainda está em adaptação para o português. Enquanto
            isso, o texto original está disponível na fonte, no fim da página.
          </p>
        )}
      </div>

      <SourceNote artigo={artigo} />

      {/* Depois da atribuição, nunca antes: a fonte original é requisito
          editorial (CLAUDE.md §6) e não pode ficar abaixo de um anúncio, nem
          ser confundida com ele. Aqui o leitor já terminou a matéria — é a
          posição de maior valor que não interrompe leitura. */}
      <AdSlot formato="retangulo" id="anuncio-materia" className="mt-12" />

      <RelatedArticles artigos={relacionados} />
    </>
  );
}

function MateriaSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-5">
      <div className="h-4 w-40 rounded bg-surface-2" />
      <div className="h-14 w-full rounded bg-surface-2" />
      <div className="h-14 w-4/5 rounded bg-surface-2" />
      <div className="mt-4 aspect-[16/9] rounded-[18px] bg-surface-2" />
    </div>
  );
}
