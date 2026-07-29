import { connection } from "next/server";
import {
  IDIOMA,
  NOME_SITE,
  escaparXml,
  getSiteUrl,
  listarArtigosDesde,
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
  const desde = Math.floor(Date.now() / 1000) - JANELA_HORAS * 3600;
  const artigos = await listarArtigosDesde(desde, MAX_URLS);

  const corpo = artigos.map((a) => entrada(a, base)).join("\n");
  const xml = `${CABECALHO}\n${corpo}${corpo ? "\n" : ""}</urlset>\n`;

  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      // Curto de propósito: a janela de 48h se move a cada minuto, e um
      // sitemap de notícias servido de cache velho anuncia matéria expirada.
      "cache-control": "public, max-age=300, s-maxage=300",
      "x-robots-tag": "noindex",
    },
  });
}

function entrada(artigo: ArtigoIndexavel, base: string): string {
  const url = `${base}${rotaArtigo(artigo.slug)}`;
  return [
    "  <url>",
    `    <loc>${escaparXml(url)}</loc>`,
    "    <news:news>",
    "      <news:publication>",
    `        <news:name>${escaparXml(NOME_SITE)}</news:name>`,
    // ISO 639-1 de duas letras. 'pt-BR' aqui é motivo de rejeição.
    `        <news:language>${IDIOMA}</news:language>`,
    "      </news:publication>",
    `      <news:publication_date>${paraIso(artigo.publishedAt)}</news:publication_date>`,
    `      <news:title>${escaparXml(tituloArtigo(artigo))}</news:title>`,
    "    </news:news>",
    "  </url>",
  ].join("\n");
}
