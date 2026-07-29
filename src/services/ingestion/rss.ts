/**
 * Parser de RSS 2.0 sobre `fast-xml-parser` (compatível com Workers — sem
 * dependência de APIs Node).
 *
 * `fast-xml-parser` devolve uma árvore sem tipo. CLAUDE.md §8 proíbe `any`, e a
 * saída de um XML de terceiro é justamente onde `any` machuca: um `<title>` que
 * vira `number` porque a manchete era "2026" derruba a ingestão em produção.
 * Por isso a árvore é tratada como `unknown` e atravessada por acessores que
 * estreitam o tipo — nada aqui confia na forma do documento.
 */

import { XMLParser } from "fast-xml-parser";

// ---------------------------------------------------------------------------
// Modelo neutro (o que a ingestão consome)
// ---------------------------------------------------------------------------

export interface MidiaRss {
  url?: string;
  /** `media:description` — legenda da foto. */
  descricao?: string;
  /** `media:credit role="photographer"` — crédito da foto. */
  credito?: string;
  largura?: number;
  altura?: number;
}

export interface ItemRss {
  titulo?: string;
  link?: string;
  guid?: string;
  guidEhPermalink: boolean;
  descricao?: string;
  /** `content:encoded` — HTML integral. Só o EWTN publica. */
  conteudoHtml?: string;
  pubDate?: string;
  autor?: string;
  categorias: string[];
  enclosureUrl?: string;
  midia?: MidiaRss;
}

export interface FeedRss {
  titulo?: string;
  /** `<ttl>` em minutos, quando declarado. */
  ttlMinutos?: number;
  itens: ItemRss[];
}

// ---------------------------------------------------------------------------
// Acessores seguros sobre a árvore `unknown`
// ---------------------------------------------------------------------------

function comoRegistro(valor: unknown): Record<string, unknown> | undefined {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : undefined;
}

function comoLista(valor: unknown): unknown[] {
  if (valor === undefined || valor === null) return [];
  return Array.isArray(valor) ? valor : [valor];
}

/** Texto de um nó, seja ele string crua ou objeto com `#text` e atributos. */
function comoTexto(valor: unknown): string | undefined {
  if (typeof valor === "string") return valor.trim() || undefined;
  if (typeof valor === "number" || typeof valor === "boolean") return String(valor);
  const registro = comoRegistro(valor);
  if (registro) return comoTexto(registro["#text"]);
  return undefined;
}

function atributo(valor: unknown, nome: string): string | undefined {
  const registro = comoRegistro(valor);
  return registro ? comoTexto(registro[`@_${nome}`]) : undefined;
}

function comoInteiro(valor: string | undefined): number | undefined {
  if (valor === undefined) return undefined;
  const numero = Number.parseInt(valor, 10);
  return Number.isFinite(numero) ? numero : undefined;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  // Sem coerção de tipo: manchete numérica continua string, data continua string.
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: true,
  /**
   * OBRIGATÓRIO para feeds de WordPress.
   *
   * `processEntities` sozinho só resolve as cinco entidades do XML
   * (`&amp; &lt; &gt; &quot; &apos;`). No parser, `numericAllowed` é ligado por
   * ESTA opção — sem ela, o título do Sign of the Cross chega como
   * "decries &#8216;total secrecy&#8217;" e o slug vira
   * "decries-8216-total-secrecy-8217". Verificado no feed real.
   * Também habilita as entidades HTML nomeadas (`&nbsp;`, `&mdash;`, `&hellip;`).
   */
  htmlEntities: true,
  // Namespaces preservados: precisamos distinguir `content:encoded` de `description`.
  removeNSPrefix: false,
  // Item e category são "0 ou mais" por natureza; sem isto, um feed com um único
  // item devolveria objeto em vez de array e o `.map()` quebraria.
  isArray: (nome) => nome === "item" || nome === "category",
});

function extrairMidia(bruto: unknown): MidiaRss | undefined {
  const primeiro = comoLista(bruto)[0];
  if (primeiro === undefined) return undefined;

  const url = atributo(primeiro, "url");
  if (!url) return undefined;

  const registro = comoRegistro(primeiro);
  return {
    url,
    descricao: registro ? comoTexto(registro["media:description"]) : undefined,
    credito: registro ? comoTexto(registro["media:credit"]) : undefined,
    largura: comoInteiro(atributo(primeiro, "width")),
    altura: comoInteiro(atributo(primeiro, "height")),
  };
}

function extrairItem(bruto: unknown): ItemRss {
  const item = comoRegistro(bruto) ?? {};

  return {
    titulo: comoTexto(item.title),
    link: comoTexto(item.link),
    guid: comoTexto(item.guid),
    // Ausente = `true` por padrão na spec do RSS 2.0.
    guidEhPermalink: (atributo(item.guid, "isPermaLink") ?? "true") !== "false",
    descricao: comoTexto(item.description),
    conteudoHtml: comoTexto(item["content:encoded"]),
    pubDate: comoTexto(item.pubDate),
    autor: comoTexto(item["dc:creator"]) ?? comoTexto(item.author),
    categorias: comoLista(item.category)
      .map((c) => comoTexto(c))
      .filter((c): c is string => Boolean(c)),
    enclosureUrl: atributo(item.enclosure, "url"),
    midia: extrairMidia(item["media:content"]),
  };
}

/** Analisa um documento RSS 2.0. Lança se o XML não tiver `rss > channel`. */
export function analisarRss(xml: string): FeedRss {
  const arvore: unknown = parser.parse(xml);

  const rss = comoRegistro(comoRegistro(arvore)?.rss);
  const canal = comoRegistro(comoLista(rss?.channel)[0]);

  if (!canal) {
    throw new Error("Documento não é um RSS 2.0 válido: falta rss > channel");
  }

  return {
    titulo: comoTexto(canal.title),
    ttlMinutos: comoInteiro(comoTexto(canal.ttl)),
    itens: comoLista(canal.item).map(extrairItem),
  };
}
