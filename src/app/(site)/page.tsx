import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdSlot } from "@/components/ads/ad-slot";
import { ArticleCard } from "@/components/article/article-card";
import { SiteJsonLd } from "@/components/seo/json-ld";
import { Editorial } from "@/components/home/editorial";
import { Masthead } from "@/components/home/masthead";
import { Newsletter } from "@/components/home/newsletter";
import { SectionHeading } from "@/components/home/section-heading";
import {
  LiturgyPanel,
  LiturgyPanelSkeleton,
} from "@/components/home/today-line";
import {
  TopicFilter,
  type ChipDeTema,
  type ItemFiltravel,
} from "@/components/home/topic-filter";
import { WeeklyHighlights } from "@/components/home/weekly-highlights";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import {
  buscarEditorial,
  listarDestaquesDaSemana,
  listarPaginado,
  listarPublicados,
} from "@/lib/articles";
import { CATEGORIAS, classesTom } from "@/lib/categories";
import { metadataHome, ROTA_ARQUIVO } from "@/lib/seo";

/**
 * A home era a ÚNICA página do site sem metadata — sem canônica, sem Open
 * Graph, sem cartão do X e sem o `<link rel="alternate">` que anuncia o RSS.
 * Ela caía no título padrão do root layout e mais nada. `metadataHome()` já
 * existia pronta em `src/lib/seo.ts` desde a Fase 1.D; só nunca foi ligada.
 */
export async function generateMetadata(): Promise<Metadata> {
  return metadataHome();
}

/**
 * Capa.
 *
 * ## Por que tudo que toca o banco está dentro de `<Suspense>`
 *
 * O binding do D1 só existe dentro de uma requisição do Worker — no `next build`
 * ele não existe, e tentar abri-lo faz o OpenNext pedir credencial da Cloudflare
 * e o build falhar. Isso não é limitação a contornar: é o Partial Prerendering
 * funcionando como deve. A casca (masthead, títulos, newsletter) é prerenderizada
 * e servida instantaneamente; as ilhas que dependem de dados chegam em streaming
 * na requisição, já com `"use cache"` por trás.
 *
 * Consequência prática: **não existe `generateStaticParams` neste projeto.**
 * Num portal que ingere a cada 15 minutos, pré-gerar rotas no build só
 * congelaria uma lista que nasce desatualizada.
 */
export default function Home() {
  return (
    <>
      {/* `WebSite` + `NewsMediaOrganization`, uma vez só no site inteiro.
          O componente existia desde a Fase 1.D e nunca havia sido renderizado —
          ou seja, o portal não declarava a própria organização em nenhuma
          página, que é justamente o sinal de E-E-A-T que o Google procura num
          veículo de notícia. Fica fora do `<Suspense>` porque não toca o banco. */}
      <SiteJsonLd />

      <Masthead />

      <Suspense fallback={<DestaquesSkeleton />}>
        <Destaques />
      </Suspense>

      <Suspense fallback={null}>
        <Ultimas />
      </Suspense>

      <Suspense fallback={null}>
        <FaixaEditorial />
      </Suspense>

      {/* Entre o fim do conteúdo e a newsletter. A faixa 728×90 só existe de
          `md` para cima (ver `src/components/ads/zonas.ts`): no celular ela
          seria cortada, e criativo cortado é impressão que a rede cobra e o
          leitor não vê. No celular a monetização fica na página de matéria,
          que é onde está o volume de um portal de notícias. */}
      <AdSlot formato="faixa" id="anuncio-capa" className="mt-20 px-4" />

      {/* Estático: não depende de dado nenhum, então é prerenderizado. */}
      <Newsletter />
    </>
  );
}

/**
 * Dobra principal: manchetes à esquerda, coluna litúrgica à direita.
 *
 * A coluna da direita fica FORA do `if` de manchetes de propósito. Antes ela
 * era filha do bloco de destaques, que retorna nada quando não há artigo
 * publicado — e levava a liturgia junto. Resultado: portal recém-publicado, ou
 * com a fila de adaptação represada, aparecia completamente vazio, apesar de o
 * calendário de 1962 estar gravado no banco.
 *
 * A liturgia é conteúdo PRÓPRIO: não vem de fonte externa, não passa por
 * adaptação e não depende de cota de IA. Não faz sentido que a ausência de
 * notícia a esconda — é justamente o que sustenta a capa enquanto a fila drena.
 */
async function Destaques() {
  // `connection()` porque o binding do D1 não existe no build — e porque o que
  // fosse pré-renderizado viria do banco LOCAL, não do de produção. Ver a nota
  // longa em `src/components/layout/nav.ts`.
  await connection();

  const [artigos, destaquesSemana] = await Promise.all([
    listarPublicados(3),
    listarDestaquesDaSemana(4),
  ]);

  const [destaque, ...secundarios] = artigos;

  return (
    <Container as="section" aria-labelledby="destaques">
      {/* O design não desenha título nesta faixa — as manchetes falam por si.
          Mas sem um h2 a estrutura saltaria de h1 (masthead) direto para os h3
          dos cards, e quem navega por cabeçalhos perderia o degrau. */}
      <h2 id="destaques" className="sr-only">
        Destaques da capa
      </h2>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10">
        <div className="flex min-w-0 flex-col gap-5">
          {destaque ? (
            <>
              {/* Sem Reveal e com priority na imagem: é o LCP da capa. */}
              <ArticleCard
                artigo={destaque}
                variante="destaque"
                prioridadeDeImagem
              />

              {secundarios.length > 0 ? (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  {secundarios.map((artigo) => (
                    <ArticleCard key={artigo.slug} artigo={artigo} />
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <SemNoticiasAinda />
          )}
        </div>

        <aside className="flex flex-col gap-[clamp(16px,2vw,22px)] lg:sticky lg:top-[74px] lg:self-start">
          <Suspense fallback={<LiturgyPanelSkeleton />}>
            <LiturgyPanel />
          </Suspense>

          <WeeklyHighlights artigos={destaquesSemana} />
        </aside>
      </div>
    </Container>
  );
}

/**
 * Estado real de um portal cuja fila ainda não drenou.
 *
 * Dizer o que está acontecendo é melhor que uma coluna em branco: o leitor
 * entende que o site está vivo, e a liturgia ao lado prova. Sem promessa de
 * horário — a cadência depende de cota de IA e prometer o que não se controla
 * é pior que não prometer.
 */
function SemNoticiasAinda() {
  return (
    <div className="rounded-[18px] border border-line bg-surface p-8 shadow-card">
      <p className="text-xs tracking-[0.12em] text-ink-3 uppercase">
        Edição em preparo
      </p>
      <p className="mt-3 max-w-[46ch] text-[17px] leading-[1.55] text-ink-2">
        As matérias do dia ainda estão sendo preparadas. Enquanto isso, a
        liturgia e o santo de hoje estão ao lado.
      </p>
    </div>
  );
}

/** Reserva a silhueta da dobra principal para o streaming não deslocar nada. */
function DestaquesSkeleton() {
  return (
    <Container aria-hidden="true">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10">
        <div className="flex min-w-0 flex-col gap-5">
          <div className="aspect-[16/10] rounded-[18px] bg-surface-2" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="h-64 rounded-[18px] bg-surface-2" />
            <div className="h-64 rounded-[18px] bg-surface-2" />
          </div>
        </div>
        <div className="flex flex-col gap-5">
          <LiturgyPanelSkeleton />
        </div>
      </div>
    </Container>
  );
}

/**
 * Quanto a capa carrega além dos 3 destaques.
 *
 * Era 30 — e as 27 iam TODAS para o HTML, porque a régua de temas filtra com
 * `hidden` em vez de refazer a consulta. A capa pagava download e parse do
 * acervo quase inteiro para exibir um terço dele. O acervo agora vive em
 * `/noticias`, com paginação de verdade; aqui fica só a primeira dobra.
 */
const NA_CAPA = 12;

async function Ultimas() {
  await connection();
  const { artigos, total } = await listarPaginado({ porPagina: NA_CAPA });
  const doFiltro = artigos.slice(3);
  if (doFiltro.length === 0) return null;

  // Chips derivados do conteúdo real: categoria sem matéria nenhuma não vira
  // botão. É a mesma regra que tira "Igreja no Brasil" da navegação — um filtro
  // que só pode devolver zero resultados não é filtro, é armadilha.
  const presentes = new Set(doFiltro.map((a) => a.categorySlug));
  const chips: ChipDeTema[] = [
    { slug: "todos", label: "Todos", classesAtivo: "bg-ink text-bg" },
    ...CATEGORIAS.filter((c) => c.noChip && presentes.has(c.slug)).map((c) => ({
      slug: c.slug,
      label: c.label,
      classesAtivo: classesTom(c.tom),
    })),
  ];

  const itens: ItemFiltravel[] = doFiltro.map((artigo) => ({
    id: artigo.id,
    categoria: artigo.categorySlug,
    card: <ArticleCard artigo={artigo} />,
  }));

  return (
    <Container as="section" aria-labelledby="ultimas" className="mt-20">
      <Reveal>
        <SectionHeading
          id="ultimas"
          sobrancelha="Editorias"
          titulo="Últimas notícias"
          href={ROTA_ARQUIVO}
          rotuloDoLink="Ver todas"
        />
        <TopicFilter chips={chips} itens={itens} className="mt-6" />

        {/* O link do cabeçalho resolve para quem lê de cima para baixo; este
            botão resolve para quem chegou ao fim da lista, que é onde a
            vontade de "ver mais" realmente aparece. */}
        <div className="mt-10 flex flex-col items-center gap-2">
          <Link
            href={ROTA_ARQUIVO}
            className="inline-flex min-h-11 touch-manipulation items-center rounded-full border border-line bg-surface px-6 text-[14px] font-medium text-ink transition-colors duration-200 ease-dc hover:border-blue-f hover:text-blue-f"
          >
            Ver todas as notícias
            <span aria-hidden="true" className="ml-2">
              →
            </span>
          </Link>
          <p className="text-[13px] text-ink-3">
            {total} {total === 1 ? "matéria publicada" : "matérias publicadas"}
          </p>
        </div>
      </Reveal>
    </Container>
  );
}

async function FaixaEditorial() {
  await connection();
  const artigo = await buscarEditorial();
  return <Editorial artigo={artigo} />;
}
