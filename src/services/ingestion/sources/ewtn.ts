/**
 * Fonte: EWTN News — https://www.ewtnnews.com/rss
 *
 * Levantamento ao vivo (27/07/2026): RSS 2.0, 50 itens, `<ttl>15</ttl>` (é a
 * própria fonte sugerindo o intervalo de polling que adotamos). Cada item traz
 * tudo que precisamos sem uma segunda requisição:
 *   `content:encoded` (HTML integral), `media:content` (imagem + `media:credit`
 *   + `media:description`), `dc:creator`, `category` (só `World` ou `Vatican`),
 *   `pubDate` (RFC 822 GMT) e `guid` permalink.
 *
 * O robots.txt deles emite `Content-Signal: search=yes, ai-train=no,
 * use=reference` — `use=reference` cobre exatamente o que fazemos (citar e
 * linkar de volta), e não treinamos modelo. Ver MEMORY.md §2.3.
 */

import { mapearCategoria } from "@/lib/categories";
import { canonicalizarUrlSegura } from "@/lib/hash";
import { ACCEPT_FEED, buscarTexto } from "../http";
import { paraUnixSegundos, textoLimpo, truncar } from "../normalize";
import { podeBuscar } from "../robots";
import { analisarRss, type ItemRss } from "../rss";
import type { ColetaDaFonte, ContextoIngestao, ItemNormalizado } from "../types";

export const FEED_EWTN = "https://www.ewtnnews.com/rss";
export const NOME_EWTN = "EWTN News";

/**
 * Teto do material bruto guardado por item.
 *
 * Grande o bastante para a adaptação ter contexto real (matéria típica do EWTN
 * tem 2–6 mil caracteres) e pequeno o bastante para não inchar a linha do D1.
 */
const LIMITE_MATERIA_PRIMA = 6_000;

function normalizar(item: ItemRss, ctx: ContextoIngestao): ItemNormalizado | null {
  const urlCanonica = canonicalizarUrlSegura(
    item.link ?? (item.guidEhPermalink ? item.guid : undefined),
  );
  const titulo = textoLimpo(item.titulo);
  if (!urlCanonica || !titulo) return null;

  // Corpo integral quando existe; senão, a descrição. É o insumo da adaptação.
  const corpo = textoLimpo(item.conteudoHtml) ?? textoLimpo(item.descricao);
  const tamanhoOriginal = corpo?.length ?? 0;

  const imagem = item.midia?.url ?? item.enclosureUrl;

  return {
    fonte: "ewtn",
    nomeFonte: NOME_EWTN,
    urlCanonica,
    guid: item.guid,
    titulo,
    excerpt: corpo ? truncar(corpo, LIMITE_MATERIA_PRIMA) : undefined,
    autor: item.autor,
    tamanhoOriginal,
    categoria: mapearCategoria({
      categorias: item.categorias,
      titulo,
      url: urlCanonica,
    }),
    tags: item.categorias,
    imagemUrl: canonicalizarUrlSegura(imagem),
    imagemCredito: item.midia?.credito,
    imagemLegenda: item.midia?.descricao,
    publicadoEm: paraUnixSegundos(item.pubDate, ctx.agora),
  };
}

export async function coletarEwtn(ctx: ContextoIngestao): Promise<ColetaDaFonte> {
  if (!(await podeBuscar(FEED_EWTN, ctx.userAgent))) {
    throw new Error(`robots.txt do EWTN proíbe ${FEED_EWTN}`);
  }

  const xml = await buscarTexto(FEED_EWTN, {
    userAgent: ctx.userAgent,
    accept: ACCEPT_FEED,
  });

  const feed = analisarRss(xml);
  const itens: ItemNormalizado[] = [];
  let descartados = 0;

  for (const bruto of feed.itens) {
    const item = normalizar(bruto, ctx);
    if (item) itens.push(item);
    else descartados++;
  }

  return { itens, descartados };
}
