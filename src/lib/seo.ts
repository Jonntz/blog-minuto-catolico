import type { Metadata } from "next";
import { and, desc, eq, gte, isNotNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getCategoria, getCategoriaOuPadrao } from "@/lib/categories";
import { getSiteUrlSync } from "@/lib/env";

/**
 * Camada de SEO do portal (CLAUDE.md §5).
 *
 * Concentra tudo que precisa concordar entre si — título, canônica, Open Graph,
 * JSON-LD, sitemaps e feed. Espalhar essas decisões pelas páginas é como um
 * portal acaba com a canônica de um jeito, o `og:url` de outro e o `@id` do
 * JSON-LD de um terceiro; o Google então trata a mesma matéria como três URLs.
 *
 * Duas regras que valem para o arquivo inteiro:
 *
 *  1. **A URL base NUNCA é literal.** Vem sempre de `getValidatedEnv().SITE_URL`.
 *     O domínio definitivo ainda não foi decidido (MEMORY.md §3) — qualquer
 *     `https://...` escrito à mão aqui viraria dívida silenciosa.
 *  2. **Atribuição é requisito de produto, não enfeite** (CLAUDE.md §6). O
 *     `NewsArticle` carrega `isBasedOn` e `citation` apontando para o original,
 *     com o nome da fonte. É o que sustenta o E-E-A-T e o que nos separa de um
 *     agregador que copia.
 */

// ---------------------------------------------------------------------------
// Identidade
// ---------------------------------------------------------------------------

/** Com acento. Confirmado pelo design (header, masthead, rodapé). */
export const NOME_SITE = "Minuto Católico";

export const DESCRICAO_SITE =
  "Notícias, documentos e vida da Igreja — com clareza e sem ruído.";

export const LOCALE = "pt_BR";
/** ISO 639-1 puro: é o que o Google News exige em <news:language>. */
export const IDIOMA = "pt";

/**
 * Logo do publisher para o JSON-LD.
 *
 * PLACEHOLDER gerado nesta entrega (`public/logo.png`) só para o schema não
 * apontar para um 404 — rich result com logo quebrado é pior do que nenhum.
 * A identidade visual definitiva deve substituir o arquivo mantendo o caminho.
 */
export const LOGO = { caminho: "/logo.png", largura: 512, altura: 512 } as const;

/** Fallback de imagem social quando o artigo não tem imagem de destaque. */
export const OG_PADRAO = {
  caminho: "/og-default.png",
  largura: 1200,
  altura: 630,
} as const;

/** Limite prático do `headline` para rich results do Google. */
const MAX_HEADLINE = 110;
/** Descrições acima disso viram reticências na SERP de qualquer jeito. */
const MAX_DESCRICAO = 200;

// ---------------------------------------------------------------------------
// Rotas canônicas — CONTRATO com as páginas
// ---------------------------------------------------------------------------

/**
 * Estas funções são a definição de onde cada conteúdo mora. Sitemap, feed,
 * canônica e JSON-LD usam TODOS elas; se as páginas usarem outra coisa, o
 * portal passa a divergir de si mesmo e só se descobre pelo Search Console.
 */
export function rotaArtigo(slug: string): string {
  return `/noticia/${slug}`;
}

export function rotaCategoria(slug: string): string {
  return `/categoria/${slug}`;
}

export const ROTA_HOME = "/";
export const ROTA_ARQUIVO = "/noticias";

/**
 * URL do arquivo, omitindo o que é padrão.
 *
 * `/noticias` e `/noticias?pagina=1` seriam a mesma listagem em dois endereços —
 * conteúdo duplicado para o Google e canônica ambígua. Página 1 e "todas as
 * editorias" simplesmente não aparecem na query.
 */
export function rotaArquivo({
  categoria,
  pagina,
}: { categoria?: string; pagina?: number } = {}): string {
  const query = new URLSearchParams();
  if (categoria) query.set("categoria", categoria);
  if (pagina && pagina > 1) query.set("pagina", String(pagina));
  const s = query.toString();
  return s ? `${ROTA_ARQUIVO}?${s}` : ROTA_ARQUIVO;
}

/**
 * Páginas institucionais.
 *
 * Ficam no contrato junto com as demais rotas porque rodapé, sitemap e a
 * política de indexação precisam concordar sobre elas — que é exatamente o tipo
 * de divergência que este arquivo existe para evitar.
 */
export const PAGINAS_INSTITUCIONAIS = [
  { slug: "sobre", titulo: "Sobre" },
  { slug: "politica-editorial", titulo: "Política editorial" },
  { slug: "privacidade", titulo: "Política de Privacidade" },
  { slug: "termos", titulo: "Termos de Uso" },
  { slug: "contato", titulo: "Contato" },
] as const;

export type SlugInstitucional = (typeof PAGINAS_INSTITUCIONAIS)[number]["slug"];

export function rotaInstitucional(slug: SlugInstitucional): string {
  return `/${slug}`;
}

// ---------------------------------------------------------------------------
// URLs
// ---------------------------------------------------------------------------

export async function getSiteUrl(): Promise<string> {
  // Síncrona por dentro (lê process.env), mas mantém a assinatura assíncrona
  // para não quebrar os chamadores. Ver `getSiteUrlSync` em src/lib/env.ts:
  // ler o binding do Worker aqui derruba o build sob Cache Components.
  return getSiteUrlSync();
}

/** Absolutiza um caminho interno. Passa adiante URLs que já são absolutas. */
export async function urlAbsoluta(caminho: string): Promise<string> {
  if (/^https?:\/\//i.test(caminho)) return caminho;
  const base = await getSiteUrl();
  return `${base}${caminho.startsWith("/") ? caminho : `/${caminho}`}`;
}

// ---------------------------------------------------------------------------
// Modelo de entrada
// ---------------------------------------------------------------------------

/**
 * O que o SEO precisa saber de um artigo.
 *
 * Deliberadamente ESTRUTURAL, e não `typeof articles.$inferSelect`: um
 * `Article` do Drizzle satisfaz esta interface por atribuição, e um objeto
 * mockado também. Assim a frente de design consegue montar as páginas com dados
 * falsos sem esperar o D1 ficar pronto, e nada muda quando o dado vira real.
 */
export interface ArtigoSeo {
  slug: string;
  /** Título adaptado em PT-BR. Cai para `sourceTitle` enquanto for `null`. */
  title: string | null;
  dek: string | null;
  sourceTitle: string;
  sourceExcerpt: string | null;
  /** Nome da fonte, exibido como "Fonte: X". */
  sourceName: string;
  /** URL canônica do original. Linkada de volta — CLAUDE.md §6. */
  sourceUrl: string;
  sourceAuthor: string | null;
  imageUrl: string | null;
  imageCaption?: string | null;
  categorySlug: string;
  tags?: string[] | null;
  /** Unix em SEGUNDOS (o schema guarda inteiro, não Date). */
  publishedAt: number;
  updatedAt: number;
}

/**
 * Estes dois recebem apenas o pedaço de que precisam, e não `ArtigoSeo`
 * inteiro: assim servem tanto à página (que tem o artigo completo) quanto ao
 * feed e aos sitemaps (que só selecionam algumas colunas do banco).
 */
export function tituloArtigo(
  artigo: Pick<ArtigoSeo, "title" | "sourceTitle">,
): string {
  return artigo.title?.trim() || artigo.sourceTitle;
}

/**
 * Descrição do artigo para meta description, Open Graph e JSON-LD.
 *
 * ⚠️ NÃO cair em `sourceExcerpt`. Esse campo carrega até 6.000 caracteres do
 * CORPO da matéria original (a ingestão o usa como matéria-prima para a
 * adaptação — ver `src/services/ingestion/sources/ewtn.ts`). Usá-lo aqui
 * publicaria texto verbatim da fonte como se fosse nosso, dentro de metadados
 * que o Google indexa — exatamente o que o `CLAUDE.md` §6 proíbe.
 *
 * Um artigo `published` sempre tem `dek` (os guard-rails da Fase 1.C reprovam
 * sem ele), então esta reserva é puramente defensiva — e degrada para a
 * descrição do site, nunca para texto de terceiro.
 */
export function descricaoArtigo(artigo: Pick<ArtigoSeo, "dek">): string {
  const bruta = artigo.dek?.trim() ?? "";
  return bruta ? truncar(bruta, MAX_DESCRICAO) : DESCRICAO_SITE;
}

// ---------------------------------------------------------------------------
// generateMetadata
// ---------------------------------------------------------------------------

/**
 * Metadados da página de artigo.
 *
 * Uso na página (lembrando que no Next 16 `params` é Promise — CLAUDE.md §5):
 *
 * ```ts
 * export async function generateMetadata(
 *   { params }: { params: Promise<{ slug: string }> },
 * ): Promise<Metadata> {
 *   const { slug } = await params;
 *   const artigo = await getArtigo(slug);
 *   if (!artigo) return metadataNaoEncontrado();
 *   return metadataArtigo(artigo);
 * }
 * ```
 */
export async function metadataArtigo(artigo: ArtigoSeo): Promise<Metadata> {
  const base = await getSiteUrl();
  const url = `${base}${rotaArtigo(artigo.slug)}`;
  const titulo = tituloArtigo(artigo);
  const descricao = descricaoArtigo(artigo);
  const imagem = await imagemSocial(artigo);
  const categoria = getCategoriaOuPadrao(artigo.categorySlug);

  return {
    metadataBase: new URL(base),
    title: titulo,
    description: descricao,
    alternates: { canonical: url },
    keywords: artigo.tags ?? undefined,
    authors: [{ name: `Redação ${NOME_SITE}`, url: base }],
    category: categoria.label,
    openGraph: {
      type: "article",
      url,
      siteName: NOME_SITE,
      locale: LOCALE,
      title: titulo,
      description: descricao,
      images: [imagem],
      publishedTime: paraIso(artigo.publishedAt),
      modifiedTime: paraIso(artigo.updatedAt),
      section: categoria.label,
      tags: artigo.tags ?? undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: titulo,
      description: descricao,
      images: [imagem.url],
    },
    other: {
      // Atribuição legível por máquina, além do JSON-LD e do bloco "Fonte: X"
      // na página. Redundância barata, e é o primeiro lugar onde um auditor
      // olha para checar se o portal reconhece a origem.
      "article:opinion": "false",
      "og:article:author": artigo.sourceAuthor ?? artigo.sourceName,
    },
  };
}

/** Metadados de uma listagem por categoria. */
export async function metadataCategoria(slug: string): Promise<Metadata> {
  const base = await getSiteUrl();
  const categoria = getCategoria(slug);
  const rotulo = categoria?.label ?? slug;
  const descricao = `Tudo sobre ${rotulo} no ${NOME_SITE}: ${DESCRICAO_SITE.toLowerCase()}`;
  const url = `${base}${rotaCategoria(slug)}`;

  return {
    metadataBase: new URL(base),
    title: rotulo,
    description: truncar(descricao, MAX_DESCRICAO),
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: NOME_SITE,
      locale: LOCALE,
      title: `${rotulo} · ${NOME_SITE}`,
      description: truncar(descricao, MAX_DESCRICAO),
      images: [await ogPadrao()],
    },
    twitter: { card: "summary_large_image" },
  };
}

/**
 * Metadados do arquivo (`/noticias`), com e sem filtro de editoria.
 *
 * A canônica aponta para a própria página filtrada/paginada — não para
 * `/noticias` cru. Canonicalizar tudo para a página 1 é o erro clássico de
 * arquivo: o Google passa a ignorar as páginas seguintes e o acervo antigo
 * some do índice.
 */
export async function metadataArquivo({
  categoria,
  pagina = 1,
}: {
  categoria?: string;
  pagina?: number;
} = {}): Promise<Metadata> {
  const base = await getSiteUrl();
  const rotulo = categoria ? getCategoria(categoria)?.label : undefined;

  const titulo = rotulo
    ? `Notícias de ${rotulo}`
    : "Todas as notícias";
  const comPagina = pagina > 1 ? `${titulo} — página ${pagina}` : titulo;

  const descricao = rotulo
    ? `Arquivo completo de ${rotulo} no ${NOME_SITE}, da mais recente para a mais antiga.`
    : `Arquivo completo do ${NOME_SITE}: todas as matérias publicadas, da mais recente para a mais antiga.`;

  const url = `${base}${rotaArquivo({ categoria, pagina })}`;

  return {
    metadataBase: new URL(base),
    title: comPagina,
    description: truncar(descricao, MAX_DESCRICAO),
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: NOME_SITE,
      locale: LOCALE,
      title: `${comPagina} · ${NOME_SITE}`,
      description: truncar(descricao, MAX_DESCRICAO),
      images: [await ogPadrao()],
    },
    twitter: { card: "summary_large_image" },
  };
}

/**
 * Metadados de uma página institucional.
 *
 * `follow` sem `index` seria errado aqui: política de privacidade e página
 * "Sobre" são exatamente o tipo de sinal de transparência que o E-E-A-T do
 * Google procura num portal de notícias. Elas DEVEM ser indexadas.
 */
export async function metadataInstitucional({
  slug,
  titulo,
  descricao,
}: {
  slug: SlugInstitucional;
  titulo: string;
  descricao: string;
}): Promise<Metadata> {
  const base = await getSiteUrl();
  const url = `${base}${rotaInstitucional(slug)}`;

  return {
    metadataBase: new URL(base),
    title: titulo,
    description: truncar(descricao, MAX_DESCRICAO),
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: NOME_SITE,
      locale: LOCALE,
      title: `${titulo} · ${NOME_SITE}`,
      description: truncar(descricao, MAX_DESCRICAO),
      images: [await ogPadrao()],
    },
    twitter: { card: "summary_large_image" },
  };
}

/**
 * Metadados da home.
 *
 * Também é onde o feed é anunciado por `alternates.types` — é assim que um
 * leitor de RSS descobre o feed a partir da home, sem ninguém digitar a URL.
 */
export async function metadataHome(): Promise<Metadata> {
  const base = await getSiteUrl();
  return {
    metadataBase: new URL(base),
    title: { absolute: NOME_SITE },
    description: DESCRICAO_SITE,
    alternates: {
      canonical: base,
      types: { "application/rss+xml": `${base}/feed.xml` },
    },
    openGraph: {
      type: "website",
      url: base,
      siteName: NOME_SITE,
      locale: LOCALE,
      title: NOME_SITE,
      description: DESCRICAO_SITE,
      images: [await ogPadrao()],
    },
    twitter: { card: "summary_large_image" },
  };
}

/** Para `notFound()` e afins: nunca indexar uma página de erro. */
export function metadataNaoEncontrado(): Metadata {
  return {
    title: "Página não encontrada",
    robots: { index: false, follow: true },
  };
}

interface ImagemOg {
  url: string;
  width: number;
  height: number;
  alt: string;
}

async function imagemSocial(artigo: ArtigoSeo): Promise<ImagemOg> {
  if (!artigo.imageUrl) return ogPadrao();
  return {
    url: artigo.imageUrl,
    // A fonte não publica dimensões no feed. Declarar as do slot padrão evita
    // que o card do WhatsApp/X recorte de forma imprevisível.
    width: OG_PADRAO.largura,
    height: OG_PADRAO.altura,
    alt: artigo.imageCaption?.trim() || tituloArtigo(artigo),
  };
}

async function ogPadrao(): Promise<ImagemOg> {
  return {
    url: await urlAbsoluta(OG_PADRAO.caminho),
    width: OG_PADRAO.largura,
    height: OG_PADRAO.altura,
    alt: NOME_SITE,
  };
}

// ---------------------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------------------

/** Nó JSON-LD. `unknown` e não `any` — CLAUDE.md §8. */
export type JsonLd = Record<string, unknown>;

/** Entidade `publisher`, com logo. Sem ela não há elegibilidade a rich result. */
export async function entidadePublisher(): Promise<JsonLd> {
  const base = await getSiteUrl();
  return {
    "@type": "NewsMediaOrganization",
    "@id": `${base}/#organizacao`,
    name: NOME_SITE,
    url: base,
    logo: {
      "@type": "ImageObject",
      url: `${base}${LOGO.caminho}`,
      width: LOGO.largura,
      height: LOGO.altura,
    },
  };
}

/**
 * `NewsArticle` do artigo.
 *
 * Sobre o `author`: o conteúdo é adaptado para PT-BR pelo nosso pipeline, então
 * o autor da OBRA PUBLICADA AQUI é a redação — atribuir a autoria ao jornalista
 * da fonte seria falso e daria a entender que ele escreveu este texto. O
 * crédito ao original está onde deve estar: em `isBasedOn` e `citation`, que é
 * o vocabulário do schema.org para exatamente isso.
 */
export async function jsonLdNewsArticle(artigo: ArtigoSeo): Promise<JsonLd> {
  const base = await getSiteUrl();
  const url = `${base}${rotaArtigo(artigo.slug)}`;
  const titulo = tituloArtigo(artigo);
  const categoria = getCategoriaOuPadrao(artigo.categorySlug);
  const imagem = artigo.imageUrl ?? `${base}${OG_PADRAO.caminho}`;

  const citacao: JsonLd = {
    "@type": "NewsArticle",
    name: artigo.sourceTitle,
    url: artigo.sourceUrl,
    publisher: { "@type": "Organization", name: artigo.sourceName },
  };
  if (artigo.sourceAuthor) {
    citacao["author"] = { "@type": "Person", name: artigo.sourceAuthor };
  }

  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "@id": `${url}#artigo`,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    // O Google trunca `headline` acima de ~110 caracteres.
    headline: truncar(titulo, MAX_HEADLINE),
    description: descricaoArtigo(artigo),
    image: [imagem],
    datePublished: paraIso(artigo.publishedAt),
    dateModified: paraIso(artigo.updatedAt),
    inLanguage: "pt-BR",
    isAccessibleForFree: true,
    articleSection: categoria.label,
    keywords: artigo.tags?.length ? artigo.tags.join(", ") : undefined,
    author: {
      "@type": "Organization",
      name: `Redação ${NOME_SITE}`,
      url: base,
    },
    publisher: await entidadePublisher(),
    // --- Atribuição (CLAUDE.md §6) ---
    isBasedOn: artigo.sourceUrl,
    citation: citacao,
    creditText: `Com base em reportagem de ${artigo.sourceName}`,
  };
}

/** `WebSite` com SearchAction — habilita a caixa de busca de sitelinks. */
export async function jsonLdWebSite(): Promise<JsonLd> {
  const base = await getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${base}/#site`,
    name: NOME_SITE,
    url: base,
    description: DESCRICAO_SITE,
    inLanguage: "pt-BR",
    publisher: await entidadePublisher(),
  };
}

export async function jsonLdOrganizacao(): Promise<JsonLd> {
  return { "@context": "https://schema.org", ...(await entidadePublisher()) };
}

export interface ItemTrilha {
  nome: string;
  /** Caminho interno; use `rotaArtigo`/`rotaCategoria`. */
  caminho: string;
}

/** `BreadcrumbList` — dá ao resultado de busca a trilha em vez da URL crua. */
export async function jsonLdTrilha(itens: readonly ItemTrilha[]): Promise<JsonLd> {
  const base = await getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: itens.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.nome,
      item: `${base}${item.caminho}`,
    })),
  };
}

/** Trilha padrão de um artigo: Início › Categoria › Título. */
export async function jsonLdTrilhaArtigo(artigo: ArtigoSeo): Promise<JsonLd> {
  const categoria = getCategoriaOuPadrao(artigo.categorySlug);
  return jsonLdTrilha([
    { nome: "Início", caminho: ROTA_HOME },
    { nome: categoria.label, caminho: rotaCategoria(categoria.slug) },
    { nome: tituloArtigo(artigo), caminho: rotaArtigo(artigo.slug) },
  ]);
}

// ---------------------------------------------------------------------------
// Leituras para sitemap / feed / news-sitemap
// ---------------------------------------------------------------------------

/**
 * Projeção mínima para as saídas de máquina.
 *
 * Estas três rotas (sitemap, feed, news-sitemap) leem a mesma coisa — artigos
 * publicados por recência. Manter a consulta em um lugar só evita que uma delas
 * comece a divergir das outras sobre o que está "no ar".
 *
 * Vive aqui, em vez de num `src/lib/queries.ts`, porque nesta fase cada frente
 * trabalha em arquivos próprios; a integração (Fase 2) deve promover isto para
 * a camada de acesso a dados compartilhada.
 */
export interface ArtigoIndexavel {
  slug: string;
  title: string | null;
  sourceTitle: string;
  dek: string | null;
  sourceExcerpt: string | null;
  sourceName: string;
  sourceUrl: string;
  imageUrl: string | null;
  categorySlug: string;
  publishedAt: number;
  updatedAt: number;
}

const COLUNAS_INDEXAVEIS = {
  slug: schema.articles.slug,
  title: schema.articles.title,
  sourceTitle: schema.articles.sourceTitle,
  dek: schema.articles.dek,
  sourceExcerpt: schema.articles.sourceExcerpt,
  sourceName: schema.articles.sourceName,
  sourceUrl: schema.articles.sourceUrl,
  imageUrl: schema.articles.imageUrl,
  categorySlug: schema.articles.categorySlug,
  publishedAt: schema.articles.publishedAt,
  updatedAt: schema.articles.updatedAt,
} as const;

/**
 * Artigos no ar, do mais recente para o mais antigo.
 *
 * `status = 'published'` e `title IS NOT NULL` juntos, não só o primeiro: um
 * item pode estar marcado como publicado e ainda não ter passado pela adaptação
 * PT-BR. Anunciar no sitemap uma página sem título é convidar o Google a
 * indexar um esqueleto.
 */
export async function listarArtigosPublicados(
  limite: number,
): Promise<ArtigoIndexavel[]> {
  const db = await getDb();
  return db
    .select(COLUNAS_INDEXAVEIS)
    .from(schema.articles)
    .where(
      and(
        eq(schema.articles.status, "published"),
        isNotNull(schema.articles.title),
      ),
    )
    .orderBy(desc(schema.articles.publishedAt))
    .limit(limite);
}

/** Artigos publicados a partir de um instante — a janela do Google News. */
export async function listarArtigosDesde(
  desdeUnix: number,
  limite: number,
): Promise<ArtigoIndexavel[]> {
  const db = await getDb();
  return db
    .select(COLUNAS_INDEXAVEIS)
    .from(schema.articles)
    .where(
      and(
        eq(schema.articles.status, "published"),
        isNotNull(schema.articles.title),
        gte(schema.articles.publishedAt, desdeUnix),
      ),
    )
    .orderBy(desc(schema.articles.publishedAt))
    .limit(limite);
}

// ---------------------------------------------------------------------------
// XML
// ---------------------------------------------------------------------------

/**
 * Escapa texto para dentro de XML.
 *
 * Não é cosmético: títulos de notícia trazem `&` e aspas o tempo todo, e um
 * único `&` cru torna o arquivo inteiro malformado — o Google descarta o
 * sitemap completo, não a linha. Os caracteres de controle são removidos porque
 * são ilegais em XML 1.0 mesmo escapados.
 */
export function escaparXml(texto: string): string {
  return texto
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Unix em segundos → ISO 8601 UTC. */
export function paraIso(unixSegundos: number): string {
  return new Date(unixSegundos * 1000).toISOString();
}

/** Unix em segundos → RFC 822, formato exigido por `pubDate` no RSS 2.0. */
export function paraRfc822(unixSegundos: number): string {
  return new Date(unixSegundos * 1000).toUTCString();
}

function truncar(texto: string, maximo: number): string {
  const limpo = texto.replace(/\s+/g, " ").trim();
  if (limpo.length <= maximo) return limpo;
  const corte = limpo.slice(0, maximo - 1);
  const espaco = corte.lastIndexOf(" ");
  return `${(espaco > maximo * 0.6 ? corte.slice(0, espaco) : corte).trimEnd()}…`;
}
