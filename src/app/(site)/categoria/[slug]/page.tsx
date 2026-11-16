import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArticleCard } from "@/components/article/article-card";
import { BookRecommendation } from "@/components/article/book-recommendation";
import { SectionHeading } from "@/components/home/section-heading";
import { JsonLd } from "@/components/seo/json-ld";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import { listarPorCategoria } from "@/lib/articles";
import { getCategoria } from "@/lib/categories";
import {
  jsonLdTrilhaCategoria,
  metadataCategoria,
  metadataNaoEncontrado,
} from "@/lib/seo";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const categoria = getCategoria(slug);
  if (!categoria) return metadataNaoEncontrado();

  // Mesma regra de `/noticias`: sob PPR o cabeçalho sai antes do `<Suspense>`,
  // então o `notFound()` do corpo abaixo não impede o status 200. Checar aqui
  // garante `noindex` quando a editoria ainda não tem matéria publicada
  // (ex.: `/categoria/brasil`). `listarPorCategoria` é `"use cache"`.
  const artigos = await listarPorCategoria(slug, 1);
  if (artigos.length === 0) return metadataNaoEncontrado();

  return metadataCategoria(slug);
}

/**
 * Página de editoria.
 *
 * O cabeçalho vem do contrato de categorias (dado estático, sem banco) e é
 * prerenderizado; a lista depende do D1 e chega em streaming. Ver a nota em
 * `src/app/(site)/page.tsx` sobre por que nada que toque o banco pode ficar
 * fora de `<Suspense>`.
 */
export default function CategoryPage({ params }: Props) {
  // `params` NÃO é awaited aqui de propósito. Sob Cache Components ele é dado
  // de requisição não cacheado; consumi-lo no corpo da página faz a rota
  // inteira virar bloqueante ("Uncached data was accessed outside of
  // <Suspense>") e o build falha. A promise desce para dentro da fronteira.
  return (
    <Container as="section" className="py-12 sm:py-16">
      <Suspense fallback={<EditoriaSkeleton />}>
        <Editoria params={params} />
      </Suspense>
    </Container>
  );
}

async function Editoria({ params }: Props) {
  // Marca explicitamente esta ilha como de requisição. Sem isso o Next tenta
  // prerenderizá-la no build, onde o D1 não está disponível de forma confiável.
  await connection();
  const { slug } = await params;
  const categoria = getCategoria(slug);
  if (!categoria) notFound();

  const [artigos, trilhaLd] = await Promise.all([
    listarPorCategoria(slug),
    jsonLdTrilhaCategoria(slug),
  ]);

  // Editoria sem matéria publicada responde 404 em vez de servir página vazia.
  // É a contraparte de rota da regra que já esconde a categoria da navegação
  // e dos chips.
  if (artigos.length === 0) notFound();

  const [primeiro, ...demais] = artigos;

  return (
    <>
      <JsonLd id="ld-categoria" dados={trilhaLd} />

      <nav aria-label="Trilha de navegação" className="mb-6">
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
          <li>{categoria.label}</li>
        </ol>
      </nav>

      <SectionHeading
        id="titulo-da-editoria"
        nivel="h1"
        sobrancelha="Editoria"
        titulo={categoria.label}
        href="/"
        rotuloDoLink="Voltar para a capa"
      />

      <div className="mt-8 flex flex-col gap-5">
        {/* `nivelDoTitulo="h2"`: aqui os cards são filhos diretos do h1 da
            editoria, sem seção intermediária. */}
        <ArticleCard
          artigo={primeiro}
          variante="destaque"
          prioridadeDeImagem
          nivelDoTitulo="h2"
        />

        {demais.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {demais.map((artigo, i) => (
              <Reveal
                key={artigo.slug}
                delayMs={(i % 3) * 60}
                className="h-full"
              >
                <ArticleCard artigo={artigo} nivelDoTitulo="h2" />
              </Reveal>
            ))}
          </div>
        ) : null}
      </div>

      <BookRecommendation categoriaSlug={slug} />
    </>
  );
}

function EditoriaSkeleton() {
  return (
    <div aria-hidden="true" className="mt-8 flex flex-col gap-5">
      <div className="aspect-[16/10] rounded-[18px] bg-surface-2" />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-64 rounded-[18px] bg-surface-2" />
        <div className="h-64 rounded-[18px] bg-surface-2" />
        <div className="h-64 rounded-[18px] bg-surface-2" />
      </div>
    </div>
  );
}
