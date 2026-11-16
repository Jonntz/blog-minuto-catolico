import { connection } from "next/server";
import {
  IDIOMA,
  NOME_SITE,
  ROTA_ARQUIVO,
  escaparXml,
  getSiteUrl,
  listarArtigosDesde,
  listarArtigosPublicados,
  paraIso,
  rotaArtigo,
  tituloArtigo,
  type ArtigoIndexavel,
} from "@/lib/seo";

/**
 * /news-sitemap.xml — sitemap dedicado do Google News (CLAUDE.md §5).
 *
 * Por que uma Route Handler e não `app/sitemap.ts`: o `MetadataRoute.Sitemap`
 * do Next só emite o vocabulário base do protocolo (`<loc>`, `<lastmod>`,
 * `<changefreq>`, `<priority>`). O Google News exige a extensão
 * `xmlns:news` com `<news:publication>`, `<news:publication_date>` e
 * `<news:title>` — que aquele gerador não tem como produzir. Este arquivo é
 * escrito à mão por necessidade, não por preferência.
 *
 * As duas regras do Publisher Center estão codificadas abaixo e são as duas que
 * mais derrubam sitemap de notícia na validação:
 *
 *   JANELA_HORAS = 48 — artigos mais velhos que dois dias precisam SAIR daqui.
 *                       Um sitemap de notícias que acumula o acervo é rejeitado.
 *   MAX_URLS = 1000  — teto por arquivo. Acima disso, particionar.
 */

const JANELA_HORAS = 48;
const MAX_URLS = 1000;

const CABECALHO =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n' +
  '        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">';

export async function GET(): Promise<Response> {
  await connection();

  const base = await getSiteUrl();
  // Arredonda para janelas de 5 minutos para aproveitar o cache ("use cache")
  // sem fragmentar a chave a cada segundo.
  const agoraArredondado = Math.floor(Date.now() / 300_000) * 300;
  const desde = agoraArredondado - JANELA_HORAS * 3600;
  const artigos = await listarArtigosDesde(desde, MAX_URLS);

  // Pelo XSD oficial do Sitemaps (sitemap.xsd), `<urlset>` exige `minOccurs="1"`
  // para `<url>`. Quando não há artigos nas últimas 48h, um `<urlset>` vazio é
  // rejeitado pelo Google Search Console ("Tag XML ausente: url na linha 4").
  // Nessa janela silenciosa, listamos os 10 artigos mais recentes como `<url>`
  // padrão (sem `<news:news>`, para respeitar a janela de 48h do Google News).
  let corpo: string;
  if (artigos.length > 0) {
    corpo = artigos.map((a) => entrada(a, base)).join("\n");
  } else {
    const recentes = await listarArtigosPublicados(10);
    corpo =
      recentes.length > 0
        ? recentes
            .map((a) =>
              entradaUrlSimples(
                `${base}${rotaArtigo(a.slug)}`,
                Math.max(a.publishedAt, a.updatedAt),
              ),
            )
            .join("\n")
        : entradaUrlSimples(`${base}${ROTA_ARQUIVO}`, agoraArredondado);
  }
  const xml = `${CABECALHO}\n${corpo}\n</urlset>\n`;

  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      // Só faz cache público quando há artigos na janela de 48h; em janela vazia
      // evita prender resposta sem `<news:news>` no cache da borda.
      "cache-control":
        artigos.length > 0
          ? "public, max-age=300, s-maxage=300"
          : "no-store, max-age=0",
      "x-robots-tag": "noindex",
    },
  });
}

function entrada(artigo: ArtigoIndexavel, base: string): string {
  const url = `${base}${rotaArtigo(artigo.slug)}`;
  // Se o artigo ficou na fila de rascunhos e foi adaptado/publicado em PT-BR
  // depois do pubDate original da fonte, a data de publicação no nosso portal é
  // `updatedAt`.
  const dataPublicacao = Math.max(artigo.publishedAt, artigo.updatedAt);
  return [
    "  <url>",
    `    <loc>${escaparXml(url)}</loc>`,
    "    <news:news>",
    "      <news:publication>",
    `        <news:name>${escaparXml(NOME_SITE)}</news:name>`,
    // ISO 639-1 de duas letras. 'pt-BR' aqui é motivo de rejeição.
    `        <news:language>${IDIOMA}</news:language>`,
    "      </news:publication>",
    `      <news:publication_date>${paraIso(dataPublicacao)}</news:publication_date>`,
    `      <news:title>${escaparXml(tituloArtigo(artigo))}</news:title>`,
    "    </news:news>",
    "  </url>",
  ].join("\n");
}

function entradaUrlSimples(url: string, unixSegundos: number): string {
  return [
    "  <url>",
    `    <loc>${escaparXml(url)}</loc>`,
    `    <lastmod>${paraIso(unixSegundos)}</lastmod>`,
    "  </url>",
  ].join("\n");
}
