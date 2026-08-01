import { and, desc, eq, like, ne, or, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { getDb } from "@/db";
import { articles, liturgicalDays, type Article, type LiturgicalDay } from "@/db/schema";

/**
 * Camada de leitura do portal.
 *
 * Substitui `src/lib/mock-data.ts` mantendo exatamente as mesmas assinaturas,
 * para a troca não exigir mudança nas páginas.
 *
 * ## Cache
 *
 * Sob Cache Components tudo é dinâmico por padrão; o cache é explícito via
 * `"use cache"` + `cacheLife()` (perfis definidos em `next.config.ts`) e a
 * invalidação é sempre por TAG. O antigo `revalidate` numérico em `fetch` está
 * obsoleto neste modelo e não deve ser misturado.
 *
 * Quem publica artigo precisa disparar as tags — ver `TAGS` abaixo e
 * `src/lib/revalidate.ts`.
 */

export const TAGS = {
  /** Capa e qualquer listagem geral. */
  feedHome: "home-feed",
  /** Listagem de uma categoria. */
  categoria: (slug: string) => `category-${slug}`,
  /** Um artigo específico. */
  artigo: (slug: string) => `article-${slug}`,
  /** Conjunto de categorias que têm conteúdo (afeta nav e chips). */
  categoriasComConteudo: "categories-with-content",
  /** Um dia do calendário litúrgico. */
  liturgia: (data: string) => `liturgy-${data}`,
} as const;

/** Só artigos aprovados vão ao ar. `draft` e `failed_validation` nunca. */
const PUBLICADO = eq(articles.status, "published");

// ---------------------------------------------------------------------------
// Artigos
// ---------------------------------------------------------------------------

export async function listarPublicados(limite = 30): Promise<Article[]> {
  "use cache";
  cacheLife("homeFeed");
  cacheTag(TAGS.feedHome);

  const db = await getDb();
  return db
    .select()
    .from(articles)
    .where(PUBLICADO)
    .orderBy(desc(articles.publishedAt))
    .limit(limite);
}

/**
 * Uma página do acervo, com o total necessário para desenhar o paginador.
 *
 * `total` é COUNT no banco, não `artigos.length`: sem ele a página não sabe se
 * existe uma próxima, e paginador que só descobre o fim ao chegar nele é uma
 * armadilha para quem navega por teclado ou por link direto.
 */
export interface PaginaDeArtigos {
  artigos: Article[];
  /** Total de publicados que casam com o filtro. */
  total: number;
  /** Página atual, 1-based e já saneada. */
  pagina: number;
  totalDePaginas: number;
}

/** Teto de itens por página. Impede `?porPagina=100000` virar varredura. */
const MAX_POR_PAGINA = 48;

export interface OpcoesDePaginacao {
  pagina?: number;
  porPagina?: number;
  /** Slug de categoria. `undefined` = acervo inteiro. */
  categoria?: string;
}

/**
 * Listagem paginada do acervo publicado.
 *
 * Existe porque a capa lia 30 matérias de uma vez e mandava todas para o
 * cliente — a régua de temas filtrava com `hidden`, então o HTML carregava o
 * acervo inteiro para mostrar um terço dele. Com o volume de publicação diária
 * isso só piora, e é custo direto de LCP (CLAUDE.md §1).
 *
 * Cacheável por (categoria, página, tamanho): ao contrário da busca por termo
 * livre, o espaço de chaves aqui é pequeno e limitado, então não há risco de
 * encher o cache com entradas de uso único.
 */
export async function listarPaginado(
  opcoes: OpcoesDePaginacao = {},
): Promise<PaginaDeArtigos> {
  "use cache";
  cacheLife("homeFeed");
  cacheTag(
    opcoes.categoria ? TAGS.categoria(opcoes.categoria) : TAGS.feedHome,
  );

  const porPagina = Math.min(
    Math.max(1, Math.trunc(opcoes.porPagina ?? 12)),
    MAX_POR_PAGINA,
  );
  const pedida = Math.max(1, Math.trunc(opcoes.pagina ?? 1));

  const filtro = opcoes.categoria
    ? and(PUBLICADO, eq(articles.categorySlug, opcoes.categoria))
    : PUBLICADO;

  const db = await getDb();

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(articles)
    .where(filtro);

  const totalDePaginas = Math.max(1, Math.ceil(total / porPagina));
  // Página além do fim volta para a última em vez de devolver lista vazia:
  // link velho compartilhado no WhatsApp continua levando a algum lugar útil.
  const pagina = Math.min(pedida, totalDePaginas);

  const artigos = await db
    .select()
    .from(articles)
    .where(filtro)
    .orderBy(desc(articles.publishedAt))
    .limit(porPagina)
    .offset((pagina - 1) * porPagina);

  return { artigos, total, pagina, totalDePaginas };
}

export async function buscarPorSlug(slug: string): Promise<Article | undefined> {
  "use cache";
  cacheLife("article");
  cacheTag(TAGS.artigo(slug));

  const db = await getDb();
  const linhas = await db
    .select()
    .from(articles)
    .where(and(PUBLICADO, eq(articles.slug, slug)))
    .limit(1);
  return linhas[0];
}

export async function listarPorCategoria(
  categoria: string,
  limite = 30,
): Promise<Article[]> {
  "use cache";
  cacheLife("category");
  cacheTag(TAGS.categoria(categoria));

  const db = await getDb();
  return db
    .select()
    .from(articles)
    .where(and(PUBLICADO, eq(articles.categorySlug, categoria)))
    .orderBy(desc(articles.publishedAt))
    .limit(limite);
}

/**
 * Categorias que de fato têm matéria publicada.
 *
 * A navegação e os chips saem daqui: categoria vazia não vira link. Um filtro
 * que só pode devolver zero resultados não é filtro, é armadilha.
 */
export async function categoriasComConteudo(): Promise<string[]> {
  "use cache";
  cacheLife("category");
  cacheTag(TAGS.categoriasComConteudo);

  const db = await getDb();
  const linhas = await db
    .selectDistinct({ slug: articles.categorySlug })
    .from(articles)
    .where(PUBLICADO);
  return linhas.map((l) => l.slug);
}

export async function listarRelacionados(
  artigo: Pick<Article, "slug" | "categorySlug">,
  limite = 3,
): Promise<Article[]> {
  "use cache";
  cacheLife("article");
  cacheTag(TAGS.categoria(artigo.categorySlug));

  const db = await getDb();

  // Primeiro os da mesma editoria; se não houver o bastante, completa com os
  // mais recentes de qualquer editoria — um bloco "Leia também" com um item só
  // fica pior que um com três.
  const daCategoria = await db
    .select()
    .from(articles)
    .where(
      and(
        PUBLICADO,
        eq(articles.categorySlug, artigo.categorySlug),
        ne(articles.slug, artigo.slug),
      ),
    )
    .orderBy(desc(articles.publishedAt))
    .limit(limite);

  if (daCategoria.length >= limite) return daCategoria;

  const jaTem = new Set([artigo.slug, ...daCategoria.map((a) => a.slug)]);
  const recentes = await db
    .select()
    .from(articles)
    .where(PUBLICADO)
    .orderBy(desc(articles.publishedAt))
    .limit(limite + jaTem.size);

  return [
    ...daCategoria,
    ...recentes.filter((a) => !jaTem.has(a.slug)),
  ].slice(0, limite);
}

/**
 * Destaques da semana para a barra lateral.
 *
 * NÃO é "mais lidas" — não há contagem de leitura no projeto. Ver o comentário
 * em `src/components/home/weekly-highlights.tsx`.
 */
export async function listarDestaquesDaSemana(limite = 4): Promise<Article[]> {
  "use cache";
  cacheLife("homeFeed");
  cacheTag(TAGS.feedHome);

  const db = await getDb();
  const seteDiasAtras = Math.floor(Date.now() / 1000) - 7 * 24 * 3600;

  const daSemana = await db
    .select()
    .from(articles)
    .where(and(PUBLICADO, sql`${articles.publishedAt} >= ${seteDiasAtras}`))
    .orderBy(desc(articles.publishedAt))
    .limit(limite);

  if (daSemana.length > 0) return daSemana;

  // Site recém-publicado ou semana vazia: cair para os mais recentes é melhor
  // que esconder o bloco.
  return db
    .select()
    .from(articles)
    .where(PUBLICADO)
    .orderBy(desc(articles.publishedAt))
    .limit(limite);
}

/** Artigo de opinião mais recente, para a faixa editorial da capa. */
export async function buscarEditorial(): Promise<Article | undefined> {
  "use cache";
  cacheLife("homeFeed");
  cacheTag(TAGS.categoria("opiniao"));

  const db = await getDb();
  const linhas = await db
    .select()
    .from(articles)
    .where(and(PUBLICADO, eq(articles.categorySlug, "opiniao")))
    .orderBy(desc(articles.publishedAt))
    .limit(1);
  return linhas[0];
}

/**
 * Busca por texto.
 *
 * Usa `LIKE` sobre título e linha fina. É deliberadamente simples: o D1 tem
 * FTS5 nativo (CLAUDE.md §2), mas FTS exige tabela virtual e gatilhos de
 * sincronização — vale a pena quando o acervo crescer, não com dezenas de
 * matérias.
 *
 * NÃO tem `"use cache"`: o termo vem do usuário e cachear por termo arbitrário
 * enche o cache de entradas de uso único.
 */
export async function buscar(termo: string, limite = 40): Promise<Article[]> {
  const limpo = termo.trim();
  if (limpo.length < 2) return [];

  // Escapa os curingas do LIKE para que o usuário não consiga transformar a
  // busca em varredura completa da tabela.
  const alvo = `%${limpo.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;

  const db = await getDb();
  return db
    .select()
    .from(articles)
    .where(
      and(
        PUBLICADO,
        or(like(articles.title, alvo), like(articles.dek, alvo)),
      ),
    )
    .orderBy(desc(articles.publishedAt))
    .limit(limite);
}

// ---------------------------------------------------------------------------
// Liturgia
// ---------------------------------------------------------------------------

export async function buscarLiturgia(
  data: string,
): Promise<LiturgicalDay | undefined> {
  "use cache";
  cacheLife("liturgy");
  cacheTag(TAGS.liturgia(data));

  const db = await getDb();
  const linhas = await db
    .select()
    .from(liturgicalDays)
    .where(eq(liturgicalDays.date, data))
    .limit(1);
  return linhas[0];
}
