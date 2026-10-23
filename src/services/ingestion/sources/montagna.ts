/**
 * Fonte: Diane Montagna — https://dianemontagna.substack.com/feed
 *
 * Substituiu o Sign of the Cross em 23/10/2026 (o SOTC foi absorvido pela
 * LifeSiteNews, cujos termos proíbem reaproveitar mais de 25% de uma matéria —
 * ver MEMORY.md). Jornalista americana credenciada junto à Santa Sé; cobre
 * Vaticano, liturgia tradicional e a crise na Igreja, com reportagem própria.
 *
 * Levantamento ao vivo (23/10/2026): RSS 2.0 do Substack, 20 itens, 3–5 posts
 * por semana. Cada item traz `content:encoded` com o texto integral (2,8–5,7
 * mil caracteres) e foto em `<enclosure type="image/*">` — nenhuma segunda
 * requisição é necessária, o que também poupa o site de origem.
 *
 * Termos: não há licença formal, mas a página "About" declara o propósito de
 * difundir o trabalho "as widely as possible for the good of the Church". O
 * robots.txt do Substack libera `User-agent: *` (bloqueia só BLEXBot). Como em
 * toda fonte: adaptação parcial, crédito e link de volta (CLAUDE.md §6).
 *
 * Particularidades do Substack tratadas aqui:
 *  - o HTML embute widgets de assinatura NO MEIO do texto (logo após o 2º
 *    parágrafo) e um apelo de doação no fim. Sem limpar, isso iria para o
 *    modelo como se fosse parte da notícia;
 *  - posts em áudio usam o mesmo `<enclosure>` com `audio/mpeg`;
 *  - a URL da foto passa por `substackcdn.com/image/fetch/...`, que embute a
 *    original do S3 — guardamos a original, mais estável;
 *  - o feed não tem `<category>`: a editoria sai do título e da URL.
 */

import { mapearCategoria } from "@/lib/categories";
import { canonicalizarUrlSegura } from "@/lib/hash";
import { ACCEPT_FEED, buscarTexto } from "../http";
import { paraUnixSegundos, textoLimpo, truncar } from "../normalize";
import { podeBuscar } from "../robots";
import { analisarRss, type ItemRss } from "../rss";
import type { ColetaDaFonte, ContextoIngestao, ItemNormalizado } from "../types";

export const FEED_MONTAGNA = "https://dianemontagna.substack.com/feed";
export const NOME_MONTAGNA = "Diane Montagna";

/** Mesmo teto do EWTN — ver lá o porquê. */
const LIMITE_MATERIA_PRIMA = 6_000;

// ---------------------------------------------------------------------------
// Limpeza do HTML do Substack
// ---------------------------------------------------------------------------

/**
 * Remove todo `<div>` cuja abertura casa com `abertura`, INCLUINDO os `<div>`
 * aninhados dentro dele. Regex sozinha não resolve: o widget de assinatura tem
 * seis níveis de `<div>`, e um `.*?</div>` pararia no primeiro fechamento.
 */
function removerDivsBalanceadas(html: string, abertura: RegExp): string {
  let resultado = html;
  for (let guarda = 0; guarda < 20; guarda++) {
    const inicio = resultado.search(abertura);
    if (inicio < 0) break;

    const tags = /<div\b[^>]*>|<\/div>/gi;
    tags.lastIndex = inicio;
    let profundidade = 0;
    let fim = -1;
    for (let m = tags.exec(resultado); m; m = tags.exec(resultado)) {
      profundidade += m[0].startsWith("</") ? -1 : 1;
      if (profundidade === 0) {
        fim = m.index + m[0].length;
        break;
      }
    }
    // HTML malformado: corta até o fim em vez de deixar widget pela metade.
    resultado = resultado.slice(0, inicio) + (fim < 0 ? "" : resultado.slice(fim));
  }
  return resultado;
}

/** Parágrafos de pedido de assinatura/doação — não são notícia. */
const RE_APELO =
  /sustained entirely by you|reader-supported publication|becom(?:e|ing) a (?:free or )?paid subscriber|support (?:this|my) work|support independent/i;

/** HTML do post → só o texto jornalístico. Exportada para teste. */
export function limparHtmlSubstack(html: string): string {
  let limpo = removerDivsBalanceadas(html, /<div\b[^>]*class="[^"]*subscription-widget/i);
  // A foto de capa já vem pelo `<enclosure>`; a legenda dela não é texto.
  limpo = removerDivsBalanceadas(limpo, /<div\b[^>]*class="[^"]*captioned-image-container/i);
  limpo = limpo.replace(/<p\b[^>]*class="[^"]*button-wrapper[^"]*"[^>]*>[\s\S]*?<\/p>/gi, "");
  limpo = limpo.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (paragrafo, interno: string) =>
    RE_APELO.test(interno) ? "" : paragrafo,
  );
  return limpo;
}

// ---------------------------------------------------------------------------
// Imagem
// ---------------------------------------------------------------------------

/**
 * `https://substackcdn.com/image/fetch/<transformações>/<URL original codificada>`
 * → a URL original (S3). Fora desse formato, devolve a própria URL.
 */
export function imagemOriginalSubstack(url: string): string {
  const marcador = url.lastIndexOf("https%3A%2F%2F");
  if (!url.includes("substackcdn.com/image/fetch/") || marcador < 0) return url;
  try {
    return decodeURIComponent(url.slice(marcador));
  } catch {
    return url;
  }
}

function imagemDoItem(item: ItemRss): string | undefined {
  if (!item.enclosureUrl) return undefined;
  // Sem tipo declarado, aceita; com tipo, só imagem — nunca o MP3 de um episódio.
  if (item.enclosureTipo && !item.enclosureTipo.startsWith("image/")) return undefined;
  return canonicalizarUrlSegura(imagemOriginalSubstack(item.enclosureUrl));
}

// ---------------------------------------------------------------------------
// Normalização e coleta
// ---------------------------------------------------------------------------

/** Exportada para teste. */
export function normalizarMontagna(
  item: ItemRss,
  ctx: ContextoIngestao,
): ItemNormalizado | null {
  const urlCanonica = canonicalizarUrlSegura(item.link);
  const titulo = textoLimpo(item.titulo);
  if (!urlCanonica || !titulo) return null;

  const corpo =
    textoLimpo(item.conteudoHtml ? limparHtmlSubstack(item.conteudoHtml) : undefined) ??
    textoLimpo(item.descricao);

  return {
    fonte: "montagna",
    nomeFonte: NOME_MONTAGNA,
    urlCanonica,
    guid: item.guid,
    titulo,
    excerpt: corpo ? truncar(corpo, LIMITE_MATERIA_PRIMA) : undefined,
    autor: item.autor ?? NOME_MONTAGNA,
    tamanhoOriginal: corpo?.length ?? 0,
    categoria: mapearCategoria({
      categorias: item.categorias,
      titulo,
      url: urlCanonica,
    }),
    tags: item.categorias,
    imagemUrl: imagemDoItem(item),
    publicadoEm: paraUnixSegundos(item.pubDate, ctx.agora),
  };
}

export async function coletarMontagna(ctx: ContextoIngestao): Promise<ColetaDaFonte> {
  if (!(await podeBuscar(FEED_MONTAGNA, ctx.userAgent))) {
    throw new Error(`robots.txt do Substack de Diane Montagna proíbe ${FEED_MONTAGNA}`);
  }

  const xml = await buscarTexto(FEED_MONTAGNA, {
    userAgent: ctx.userAgent,
    accept: ACCEPT_FEED,
  });

  const feed = analisarRss(xml);
  const itens: ItemNormalizado[] = [];
  let descartados = 0;

  for (const bruto of feed.itens) {
    const item = normalizarMontagna(bruto, ctx);
    if (item) itens.push(item);
    else descartados++;
  }

  return { itens, descartados };
}
