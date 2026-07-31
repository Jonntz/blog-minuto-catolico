import { connection } from "next/server";
import { Suspense } from "react";
import { ArticleCard } from "@/components/article/article-card";
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
  listarPublicados,
} from "@/lib/articles";
import { CATEGORIAS, classesTom } from "@/lib/categories";

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

async function Ultimas() {
  await connection();
  const artigos = await listarPublicados(30);
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
          contador={`${itens.length} ${itens.length === 1 ? "matéria" : "matérias"}`}
        />
        <TopicFilter chips={chips} itens={itens} className="mt-6" />
      </Reveal>
    </Container>
  );
}

async function FaixaEditorial() {
  await connection();
  const artigo = await buscarEditorial();
  return <Editorial artigo={artigo} />;
}
