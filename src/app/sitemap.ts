import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { CATEGORIAS } from "@/lib/categories";
import {
  listarArtigosPublicados,
  PAGINAS_INSTITUCIONAIS,
  ROTA_ARQUIVO,
  rotaArtigo,
  rotaCategoria,
  rotaInstitucional,
  getSiteUrl,
} from "@/lib/seo";

/**
 * /sitemap.xml — sitemap GERAL do site (CLAUDE.md §5).
 *
 * Distinto do `/news-sitemap.xml`: este cobre o acervo inteiro e não tem
 * validade; aquele cobre só as 48 horas mais recentes, no formato
 * `<news:news>`, que o `sitemap.ts` do Next não sabe gerar.
 */

/**
 * Teto do protocolo: 50.000 URLs por arquivo. Muito antes de chegarmos lá
 * valerá a pena particionar com `generateSitemaps()` — quando isso acontecer,
 * este limite é o gatilho.
 */
const MAX_URLS = 50_000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Sob Cache Components tudo é dinâmico por padrão, mas a leitura do D1
  // depende do binding do Worker — que não existe durante o build. `connection`
  // é o jeito canônico de dizer "só em requisição".
  await connection();

  const base = await getSiteUrl();
  const artigos = await listarArtigosPublicados(MAX_URLS);

  const maisRecente = artigos[0]?.updatedAt;

  const home: MetadataRoute.Sitemap[number] = {
    url: base,
    lastModified: maisRecente ? new Date(maisRecente * 1000) : new Date(),
    changeFrequency: "hourly",
    priority: 1,
  };

  // Só categorias que realmente têm conteúdo. "Igreja no Brasil" hoje fica
  // vazia (MEMORY.md §3) e anunciar uma listagem vazia no sitemap é pedir para
  // o Google classificar o site como fino ("thin content").
  const comConteudo = new Set(artigos.map((a) => a.categorySlug));
  const categorias: MetadataRoute.Sitemap = CATEGORIAS.filter((c) =>
    comConteudo.has(c.slug),
  ).map((c) => ({
    url: `${base}${rotaCategoria(c.slug)}`,
    lastModified: ultimaAtualizacaoDaCategoria(artigos, c.slug),
    changeFrequency: "daily",
    priority: 0.7,
  }));

  const paginas: MetadataRoute.Sitemap = artigos.map((a) => ({
    url: `${base}${rotaArtigo(a.slug)}`,
    lastModified: new Date(a.updatedAt * 1000),
    // Matéria publicada quase não muda; dizer "daily" aqui só desperdiça
    // orçamento de rastreamento que o Google poderia gastar nas novas.
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  // Só a primeira página do arquivo entra. As seguintes são alcançáveis pelos
  // links `rel="next"`/`rel="prev"` da paginação — anunciar cada página no
  // sitemap gastaria orçamento de rastreamento com listagens que mudam de
  // conteúdo a cada publicação nova.
  const arquivo: MetadataRoute.Sitemap = [
    {
      url: `${base}${ROTA_ARQUIVO}`,
      lastModified: maisRecente ? new Date(maisRecente * 1000) : new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
    },
  ];

  // Institucionais são estáticas e raramente mudam, mas PRECISAM ser
  // indexáveis: "Sobre", "Política editorial" e "Privacidade" são o que o
  // Google lê como sinal de transparência de um portal de notícias.
  const institucionais: MetadataRoute.Sitemap = PAGINAS_INSTITUCIONAIS.map(
    (p) => ({
      url: `${base}${rotaInstitucional(p.slug)}`,
      changeFrequency: "yearly",
      priority: 0.3,
    }),
  );

  return [home, ...arquivo, ...categorias, ...institucionais, ...paginas];
}

function ultimaAtualizacaoDaCategoria(
  artigos: readonly { categorySlug: string; updatedAt: number }[],
  slug: string,
): Date {
  const marcas = artigos
    .filter((a) => a.categorySlug === slug)
    .map((a) => a.updatedAt);
  return new Date((marcas.length > 0 ? Math.max(...marcas) : 0) * 1000);
}
