import { connection } from "next/server";
import { getCategoriaOuPadrao } from "@/lib/categories";
import {
  DESCRICAO_SITE,
  NOME_SITE,
  descricaoArtigo,
  escaparXml,
  getSiteUrl,
  listarArtigosPublicados,
  paraRfc822,
  rotaArtigo,
  tituloArtigo,
  type ArtigoIndexavel,
} from "@/lib/seo";

/**
 * /feed.xml — feed RSS 2.0 DO PORTAL (CLAUDE.md §5).
 *
 * Não confundir com os feeds que a ingestão CONSOME (EWTN, Sign of the Cross):
 * este é o nosso, para os nossos leitores e para agregadores que queiram nos
 * seguir. Fluxo oposto.
 *
 * Cada item leva o resumo, nunca o texto integral. Dois motivos, e o segundo
 * pesa mais: (1) o feed existe para trazer o leitor ao portal; (2) o CLAUDE.md
 * §6 nos obriga a citar a fonte de tudo que publicamos — e um agregador que
 * copiasse nosso `<description>` inteiro perderia essa atribuição pelo caminho.
 * Por isso o crédito à fonte viaja DENTRO do resumo, não só num campo à parte.
 */

/** Suficiente para qualquer leitor; além disso é peso morto no XML. */
const MAX_ITENS = 50;

/** Sugestão de intervalo de polling, em minutos — o mesmo `ttl` que o EWTN usa. */
const TTL_MINUTOS = 15;

export async function GET(): Promise<Response> {
  await connection();

  const base = await getSiteUrl();
  const artigos = await listarArtigosPublicados(MAX_ITENS);
  const atualizadoEm = artigos[0]?.publishedAt ?? Math.floor(Date.now() / 1000);

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    "  <channel>",
    `    <title>${escaparXml(NOME_SITE)}</title>`,
    `    <link>${escaparXml(base)}</link>`,
    `    <description>${escaparXml(DESCRICAO_SITE)}</description>`,
    "    <language>pt-BR</language>",
    `    <lastBuildDate>${paraRfc822(atualizadoEm)}</lastBuildDate>`,
    `    <ttl>${TTL_MINUTOS}</ttl>`,
    // Auto-referência exigida pelos validadores de RSS; é como um leitor
    // reencontra o feed depois que a página que o anunciava muda.
    `    <atom:link href="${escaparXml(`${base}/feed.xml`)}" rel="self" type="application/rss+xml" />`,
    `    <image>`,
    `      <url>${escaparXml(`${base}/logo.png`)}</url>`,
    `      <title>${escaparXml(NOME_SITE)}</title>`,
    `      <link>${escaparXml(base)}</link>`,
    `    </image>`,
    ...artigos.map((a) => item(a, base)),
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");

  return new Response(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=600, s-maxage=600",
    },
  });
}

function item(artigo: ArtigoIndexavel, base: string): string {
  const url = `${base}${rotaArtigo(artigo.slug)}`;
  const categoria = getCategoriaOuPadrao(artigo.categorySlug);
  const resumo =
    `${descricaoArtigo(artigo)} ` +
    `(Com base em reportagem de ${artigo.sourceName} — ${artigo.sourceUrl})`;

  const linhas = [
    "    <item>",
    `      <title>${escaparXml(tituloArtigo(artigo))}</title>`,
    `      <link>${escaparXml(url)}</link>`,
    // `isPermaLink="true"` porque o guid É a URL canônica — evita que o leitor
    // trate uma matéria reeditada como item novo.
    `      <guid isPermaLink="true">${escaparXml(url)}</guid>`,
    `      <pubDate>${paraRfc822(artigo.publishedAt)}</pubDate>`,
    `      <category>${escaparXml(categoria.label)}</category>`,
    `      <dc:creator>${escaparXml(`Redação ${NOME_SITE}`)}</dc:creator>`,
    `      <description><![CDATA[${limparCdata(resumo)}]]></description>`,
    `      <source url="${escaparXml(artigo.sourceUrl)}">${escaparXml(artigo.sourceName)}</source>`,
  ];

  if (artigo.imageUrl) {
    linhas.push(
      `      <enclosure url="${escaparXml(artigo.imageUrl)}" type="image/jpeg" />`,
    );
  }

  linhas.push("    </item>");
  return linhas.join("\n");
}

/**
 * Neutraliza `]]>` dentro de CDATA.
 *
 * Um único `]]>` vindo de um título de fonte externa encerraria a seção e
 * quebraria o feed inteiro para todos os leitores — não só aquele item.
 */
function limparCdata(texto: string): string {
  return texto.replace(/]]>/g, "]]&gt;");
}
