import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Newsletter } from "@/components/home/newsletter";
import { ArticleMedia } from "@/components/ui/article-media";
import { CategoryTag } from "@/components/ui/category-tag";
import { Container } from "@/components/ui/container";
import { buscarLiturgia, listarPublicados } from "@/lib/articles";
import { chaveDoDia, dataCurta, diaPorExtenso } from "@/lib/format";
import {
  getSiteUrl,
  NOME_SITE,
  ROTA_ARQUIVO,
  ROTA_BIO,
  ROTA_HOME,
  ROTA_LITURGIA,
  rotaArtigo,
  tituloArtigo,
} from "@/lib/seo";

const DESCRICAO =
  "Acesso rápido às últimas notícias publicadas pelo Minuto Católico e à Liturgia Diária do Missal de 1962.";

export async function generateMetadata(): Promise<Metadata> {
  const base = await getSiteUrl();
  return {
    metadataBase: new URL(base),
    title: "Links e Últimas Notícias",
    description: DESCRICAO,
    alternates: { canonical: `${base}${ROTA_BIO}` },
    // Evita disputar indexação com a capa e `/noticias` no Google Search.
    robots: { index: false, follow: true },
  };
}

/**
 * Página "Link na Bio" mobile-first para o perfil do Instagram (`@minutocatolico`).
 *
 * Como legendas de feed no Instagram não tornam URLs clicáveis, todos os posts
 * automatizados direcionam o leitor para `https://minutocatolico.com.br/bio`.
 */
export default function BioPage() {
  return (
    <>
      <Container as="section" className="py-10 sm:py-14">
        <div className="mx-auto max-w-[600px]">
          <header className="text-center">
            <p className="text-xs tracking-[0.12em] text-ink-3 uppercase">
              {NOME_SITE}
            </p>
            <h1 className="mt-2 font-display text-[32px] leading-[1.06] font-semibold tracking-[-0.03em] sm:text-[38px]">
              Últimas do Portal
            </h1>
            <p className="mt-2.5 text-[15px] leading-[1.5] text-ink-2">
              Toque em qualquer notícia abaixo para ler a matéria completa em
              português.
            </p>
          </header>

          <Suspense fallback={<BioSkeleton />}>
            <ConteudoBio />
          </Suspense>
        </div>
      </Container>

      <Newsletter />
    </>
  );
}

async function ConteudoBio() {
  await connection();
  const agora = new Date();
  const hoje = chaveDoDia(agora);

  const [artigos, liturgia] = await Promise.all([
    listarPublicados(12),
    buscarLiturgia(hoje),
  ]);

  return (
    <div className="mt-8 flex flex-col gap-5">
      <Link
        href={`${ROTA_LITURGIA}?utm_source=instagram&utm_medium=bio`}
        className="flex items-center justify-between gap-4 rounded-[18px] border border-line bg-surface p-5 shadow-card transition-colors duration-200 ease-dc hover:border-blue-f"
      >
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.1em] text-green-f uppercase">
            Missal de 1962 · {diaPorExtenso(agora)}
          </p>
          <p className="mt-1 font-display text-[18px] leading-[1.2] font-semibold tracking-[-0.02em] text-ink">
            {liturgia ? liturgia.feast : "Liturgia Diária e Santo do Dia"}
          </p>
        </div>
        <span aria-hidden="true" className="shrink-0 text-sm text-blue-f">
          →
        </span>
      </Link>

      <div className="flex flex-col gap-3">
        {artigos.map((artigo) => {
          const titulo = tituloArtigo(artigo);
          return (
            <Link
              key={artigo.id}
              href={`${rotaArtigo(artigo.slug)}?utm_source=instagram&utm_medium=bio`}
              className="group flex items-center gap-4 rounded-[18px] border border-line bg-surface p-3.5 shadow-card transition-colors duration-200 ease-dc hover:border-blue-f"
            >
              <div className="w-24 shrink-0">
                <ArticleMedia
                  src={artigo.imageUrl}
                  alt={artigo.imageCaption ?? titulo}
                  width={192}
                  height={192}
                  sizes="96px"
                  className="aspect-square rounded-[12px]"
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <CategoryTag slug={artigo.categorySlug} />
                  <span className="text-[11px] text-ink-3">
                    {dataCurta(artigo.publishedAt)}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 font-display text-[16px] leading-[1.22] font-semibold tracking-[-0.02em] text-ink transition-colors duration-200 group-hover:text-blue-f">
                  {titulo}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-3">
        <Link
          href={`${ROTA_HOME}?utm_source=instagram&utm_medium=bio`}
          className="inline-flex min-h-11 touch-manipulation items-center justify-center rounded-full border border-line bg-surface px-4 text-sm font-medium text-ink transition-colors duration-200 ease-dc hover:border-blue-f hover:text-blue-f"
        >
          Ir para a capa
        </Link>
        <Link
          href={`${ROTA_ARQUIVO}?utm_source=instagram&utm_medium=bio`}
          className="inline-flex min-h-11 touch-manipulation items-center justify-center rounded-full border border-line bg-surface px-4 text-sm font-medium text-ink transition-colors duration-200 ease-dc hover:border-blue-f hover:text-blue-f"
        >
          Ver todas as notícias
        </Link>
      </div>
    </div>
  );
}

function BioSkeleton() {
  return (
    <div aria-hidden="true" className="mt-8 flex flex-col gap-3">
      <div className="h-20 rounded-[18px] bg-surface-2" />
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="h-28 rounded-[18px] bg-surface-2" />
      ))}
    </div>
  );
}
