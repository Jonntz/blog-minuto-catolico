import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArticleCard } from "@/components/article/article-card";
import { SectionHeading } from "@/components/home/section-heading";
import { CategoryLinks } from "@/components/news/category-links";
import { Pagination } from "@/components/news/pagination";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import { categoriasComConteudo, listarPaginado } from "@/lib/articles";
import { getCategoria } from "@/lib/categories";
import {
  metadataArquivo,
  metadataNaoEncontrado,
  rotaArquivo,
} from "@/lib/seo";

/** Cards por página. Três colunas em desktop, então múltiplo de 3 e 2. */
const POR_PAGINA = 12;

interface Props {
  searchParams: Promise<{ categoria?: string; pagina?: string }>;
}

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const { categoria, pagina } = await searchParams;
  const slug = categoriaValida(categoria);
  const numero = numeroDePagina(pagina);

  /**
   * Página além do fim: `noindex`.
   *
   * O `notFound()` no corpo da página (abaixo) NÃO resolve isto sozinho, e a
   * razão é o PPR: a casca é enviada com status 200 antes de o `<Suspense>`
   * resolver, então quando o `notFound()` dispara o cabeçalho já saiu. Verificado
   * em produção — `?pagina=99` devolvia 200 com o conteúdo do 404 e, pior, uma
   * canônica auto-referente para `?pagina=99`. Ou seja: uma família infinita de
   * URLs distintas, todas indexáveis.
   *
   * `generateMetadata` roda ANTES do streaming, então é aqui que o sinal para o
   * robô tem de ser emitido. `listarPaginado` é `"use cache"`, então consultar
   * daqui não quebra o PPR nem custa uma segunda ida ao banco — é a mesma chave
   * de cache que o corpo vai usar.
   */
  const { totalDePaginas } = await listarPaginado({
    pagina: numero,
    porPagina: POR_PAGINA,
    categoria: slug,
  });

  if (numero > 1 && numero > totalDePaginas) {
    return metadataNaoEncontrado();
  }

  return metadataArquivo({ categoria: slug, pagina: numero });
}

/**
 * Arquivo — todas as notícias, com filtro por editoria e paginação.
 *
 * O estado da listagem mora inteiramente na URL (`?categoria=…&pagina=…`). Isso
 * é o que permite ler só uma página do banco por requisição, em vez do que a
 * capa fazia antes: buscar 30 matérias e mandar todas para o cliente para
 * mostrar um terço.
 *
 * A casca é prerenderizada; tudo que toca o D1 fica dentro de `<Suspense>` —
 * mesma regra da capa (ver `src/app/(site)/page.tsx`).
 */
export default function NewsArchivePage({ searchParams }: Props) {
  return (
    <Container as="section" className="py-12 sm:py-16">
      <Suspense fallback={<ArquivoSkeleton />}>
        <Arquivo searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

async function Arquivo({ searchParams }: Props) {
  // O binding do D1 não existe no build — ver a nota longa em nav.ts.
  await connection();

  const params = await searchParams;
  const categoria = categoriaValida(params.categoria);
  const pagina = numeroDePagina(params.pagina);

  const [resultado, comConteudo] = await Promise.all([
    listarPaginado({ pagina, porPagina: POR_PAGINA, categoria }),
    categoriasComConteudo(),
  ]);

  /**
   * Página além do fim ⇒ 404.
   *
   * `listarPaginado` faz clamp para a última página real, e isso é deliberado e
   * bom para o leitor: um link velho no WhatsApp continua mostrando conteúdo em
   * vez de erro. Mas `generateMetadata` emitia canônica auto-referente com o
   * número PEDIDO — então `?pagina=99`, num arquivo de 3 páginas, devolvia 200 +
   * o conteúdo da página 3 + `<link rel="canonical" href="…?pagina=99">`. Uma
   * família infinita de URLs distintas, todas auto-canonicalizadas, todas com o
   * mesmo conteúdo. É armadilha de rastreamento clássica.
   *
   * O 404 é o único sinal que o Google entende sem ambiguidade aqui. Página 1
   * escapa da checagem para o arquivo vazio continuar renderizando sua mensagem
   * própria em vez de sumir.
   */
  if (pagina > 1 && pagina > resultado.totalDePaginas) {
    notFound();
  }

  const rotulo = categoria ? getCategoria(categoria)?.label : undefined;

  return (
    <>
      <SectionHeading
        id="titulo-do-arquivo"
        nivel="h1"
        sobrancelha="Arquivo"
        titulo={rotulo ? `Notícias · ${rotulo}` : "Todas as notícias"}
        contador={`${resultado.total} ${resultado.total === 1 ? "matéria" : "matérias"}`}
      />

      <CategoryLinks
        className="mt-6"
        presentes={new Set(comConteudo)}
        ativa={categoria}
        href={(slug) => rotaArquivo({ categoria: slug })}
      />

      {resultado.artigos.length === 0 ? (
        <p className="mt-10 text-[15px] text-ink-2">
          Nenhuma matéria publicada nesta editoria por enquanto.
        </p>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {resultado.artigos.map((artigo, i) => (
              <Reveal key={artigo.slug} delayMs={i * 50} className="h-full">
                {/* `h2`: aqui os cards são filhos diretos do h1 do arquivo. */}
                <ArticleCard artigo={artigo} nivelDoTitulo="h2" />
              </Reveal>
            ))}
          </div>

          <p className="mt-10 text-center text-[13px] text-ink-3">
            Página {resultado.pagina} de {resultado.totalDePaginas}
          </p>

          <Pagination
            className="mt-4"
            pagina={resultado.pagina}
            totalDePaginas={resultado.totalDePaginas}
            href={(p) => rotaArquivo({ categoria, pagina: p })}
          />
        </>
      )}
    </>
  );
}

/** Slug desconhecido é ignorado, não vira 404: filtro inválido = sem filtro. */
function categoriaValida(slug?: string): string | undefined {
  return slug && getCategoria(slug) ? slug : undefined;
}

function numeroDePagina(bruto?: string): number {
  const n = Number.parseInt(bruto ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function ArquivoSkeleton() {
  return (
    <div aria-hidden="true" className="mt-8">
      <div className="h-11 w-full max-w-[520px] rounded-full bg-surface-2" />
      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-64 rounded-[18px] bg-surface-2" />
        ))}
      </div>
    </div>
  );
}
