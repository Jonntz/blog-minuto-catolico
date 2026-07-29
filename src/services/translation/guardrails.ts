/**
 * Guard-rails da adaptação editorial.
 *
 * ---------------------------------------------------------------------------
 * POSTURA: FALHAR FECHADO
 * ---------------------------------------------------------------------------
 * Não há revisor humano neste portal. Um erro doutrinário publicado é falha de
 * credibilidade que não se desfaz com um patch. Por isso toda regra aqui é
 * escrita para reprovar na dúvida:
 *
 *   - Dado faltando não é "provavelmente ok", é reprovação.
 *   - Veredito do modelo ausente ou ilegível não é "passou", é reprovação.
 *   - Original de tamanho desconhecido não é "deve caber", é reprovação.
 *
 * Reprovar custa um artigo não publicado. Aprovar errado custa o portal.
 *
 * ---------------------------------------------------------------------------
 * DUAS CLASSES DE CHECAGEM — e por que a distinção importa
 * ---------------------------------------------------------------------------
 * 1. DETERMINÍSTICAS (a maioria): comprimento, proporção, atribuição, número
 *    inventado, idioma, marcador de recusa, veto do rito de 1962, glossário.
 *    Não passam por modelo nenhum. São as que realmente seguram o sistema.
 *
 * 2. JULGAMENTO DO MODELO (uma): `VerificacaoFactual`, produzida pelo MESMO
 *    modelo classe 8B que escreveu o texto. É uma camada A MAIS, jamais a
 *    única — ver o aviso extenso em `provider.ts`. Se um dia ela for a única
 *    coisa entre o modelo e a publicação, o desenho foi quebrado.
 */

import type { Fonte } from "@/db/schema";
import {
  TERMOS_NOVUS_ORDO_VETADOS,
  TERMOS_QUE_EXIGEM_TRADUCAO,
} from "./glossary";
import type { VerificacaoFactual } from "./provider";

// ---------------------------------------------------------------------------
// Limites — fonte única da verdade
// ---------------------------------------------------------------------------

/**
 * `prompt.ts` lê daqui para instruir o modelo, e as regras abaixo leem daqui
 * para cobrar. Se os dois números divergirem, o modelo é mandado escrever algo
 * que será reprovado — desperdício de Neurons em looping.
 */
export const LIMITES = {
  /** Corpo editorial (sem o bloco de fonte). */
  MIN_CHARS_CORPO: 700,
  MAX_CHARS_CORPO: 3200,
  MIN_PARAGRAFOS: 3,
  /** A decisão editorial é 3–5 parágrafos; 6 é a folga antes do muro de texto. */
  MAX_PARAGRAFOS: 6,

  MIN_CHARS_TITULO: 18,
  MAX_CHARS_TITULO: 130,
  MIN_CHARS_DEK: 40,
  MAX_CHARS_DEK: 280,

  /**
   * Teto de proporção sobre o original. Acima disto não é adaptação, é
   * republicação disfarçada — risco de direito autoral (CLAUDE.md §6) e de
   * penalização por conteúdo duplicado.
   */
  /**
   * Teto de 60% (era 55%, subido a pedido do usuário em 28/07/2026).
   *
   * Acima disto a "adaptação" é republicação disfarçada — risco de direito
   * autoral e de penalização por conteúdo duplicado (CLAUDE.md §6).
   */
  TETO_PROPORCAO: 0.6,
  /** Abaixo disto não é matéria, é chamada. */
  PISO_PROPORCAO: 0.18,
  /** Faixa pedida ao modelo (MEMORY.md §2.4). */
  ALVO_PROPORCAO_MIN: 0.4,
  ALVO_PROPORCAO_MAX: 0.5,

  /** Fração mínima de caracteres acentuados esperada em prosa PT-BR. */
  MIN_DENSIDADE_DIACRITICOS: 0.008,
  /** Acima disto, o texto tem cara de inglês. */
  MAX_RAZAO_STOPWORDS_EN: 0.35,

  MIN_TAGS: 2,
  MAX_TAGS: 6,
  MAX_CHARS_TAG: 32,

  /** Não deixar `validationErrors` virar um blob gigante no D1. */
  MAX_ERROS_REGISTRADOS: 20,
  MAX_CHARS_POR_ERRO: 300,
} as const;

/**
 * Menor original que consegue, em tese, produzir um corpo aprovável.
 *
 * Derivado do ALVO, não do teto: pedir ao modelo 40% de um original de 1.750
 * caracteres dá exatamente os 700 do mínimo, e o teto de 55% fica em 962 — ou
 * seja, sobra ~10% de folga para o modelo estourar o alvo sem que isso vire
 * republicação. Derivar do teto (700/0,55 = 1.273) deixaria alvo e teto
 * colados, e todo pequeno excesso reprovaria.
 *
 * Consequência prática e desagradável: um item cujo texto original disponível
 * seja menor que isto NÃO É ADAPTÁVEL. Escrever 700 caracteres de matéria a
 * partir de um excerpt de 400 exigiria inventar — exatamente o que este módulo
 * existe para impedir. Ver MEMORY.md §2.2: o feed do Sign of the Cross traz só
 * excerpt (146–645 chars), então nada dele passa por aqui enquanto a ingestão
 * não buscar o corpo na página do artigo.
 */
export const MIN_CHARS_ORIGINAL = Math.ceil(
  LIMITES.MIN_CHARS_CORPO / LIMITES.ALVO_PROPORCAO_MIN,
);

/**
 * Faixa de comprimento pedida ao modelo, em caracteres.
 *
 * Base é o texto que o modelo REALMENTE vê. Se a ingestão só conseguiu um
 * excerpt, é sobre o excerpt que a proporção faz sentido — mandar escrever 45%
 * de um artigo completo que o modelo não leu é um pedido de invenção.
 */
export function calcularAlvoCaracteres(comprimentoBase: number): {
  min: number;
  max: number;
} {
  const teto = LIMITES.MAX_CHARS_CORPO;
  const bruto = Math.round(comprimentoBase * LIMITES.ALVO_PROPORCAO_MIN);
  const min = Math.min(
    Math.max(bruto, LIMITES.MIN_CHARS_CORPO),
    teto - 200,
  );
  const max = Math.min(
    Math.max(Math.round(comprimentoBase * LIMITES.ALVO_PROPORCAO_MAX), min + 150),
    teto,
  );
  return { min, max };
}

/**
 * Hosts aceitos por fonte. O guard-rail de atribuição exige que `sourceUrl`
 * resolva para um destes — assim um link corrompido, relativo ou apontando
 * para outro domínio não vai ao ar como se fosse a fonte.
 */
export const HOSTS_POR_FONTE: Readonly<Record<Fonte, readonly string[]>> = {
  ewtn: ["ewtnnews.com", "www.ewtnnews.com"],
  sotc: ["signofthecrossmedia.com", "www.signofthecrossmedia.com"],
};

// ---------------------------------------------------------------------------
// Bloco de atribuição — obrigatório em todo artigo
// ---------------------------------------------------------------------------

/**
 * Marcador do início do bloco de fonte dentro de `bodyMd`.
 *
 * A atribuição é montada por NÓS, deterministicamente, a partir de
 * `sourceName`/`sourceUrl` — nunca escrita pelo modelo. Fica embutida no
 * `bodyMd` de propósito: se ficasse só a cargo do front-end, bastaria um
 * componente novo esquecer de renderizá-la para o portal publicar conteúdo
 * adaptado sem crédito, que é o cenário que CLAUDE.md §6 proíbe.
 *
 * O front-end pode detectar o bloco com `temBlocoFonte()` para não duplicar.
 */
export const MARCADOR_FONTE = "> **Fonte:**";

export function montarBlocoFonte(
  sourceName: string,
  sourceUrl: string,
): string {
  return `${MARCADOR_FONTE} [${sourceName}](${sourceUrl})`;
}

export function temBlocoFonte(corpoMd: string): boolean {
  return corpoMd.includes(MARCADOR_FONTE);
}

/** Corpo editorial + atribuição. É isto que vai para `articles.bodyMd`. */
export function montarCorpoFinal(
  corpoEditorial: string,
  sourceName: string,
  sourceUrl: string,
): string {
  return `${corpoEditorial.trim()}\n\n${montarBlocoFonte(sourceName, sourceUrl)}\n`;
}

/**
 * Remove um bloco de fonte que o modelo tenha escrito por conta própria.
 * O nosso é acrescentado depois; dois seguidos ficariam feios e o segundo
 * poderia ter URL alucinada.
 */
export function removerAtribuicaoDoModelo(corpo: string): string {
  return corpo
    .split(/\n{2,}/)
    .filter((p) => !/^\s*>?\s*\**\s*fontes?\s*:/i.test(p))
    .join("\n\n")
    .trim();
}

// ---------------------------------------------------------------------------
// Contexto e resultado
// ---------------------------------------------------------------------------

export interface ContextoGuardRails {
  fonte: Fonte;
  sourceName: string;
  sourceUrl: string;
  /** `articles.sourceLength`. Zero significa desconhecido ⇒ reprova. */
  comprimentoOriginal: number;
  /** Texto original em inglês, para as comparações determinísticas. */
  textoOriginal: string;

  /** Corpo EDITORIAL, sem o bloco de fonte (que é acrescentado depois). */
  corpoMd: string;
  titulo: string;
  dek: string;
  tags: readonly string[];

  /** Veredito do checador. `null` ⇒ reprova (fail-closed). */
  verificacao: VerificacaoFactual | null;
}

export interface ResultadoGuardRails {
  aprovado: boolean;
  /** Vai direto para `articles.validationErrors`. */
  erros: string[];
  /** Ids das regras que reprovaram — útil para agregar no health-check. */
  regrasReprovadas: string[];
}

interface RegraGuardRail {
  id: string;
  descricao: string;
  avaliar(ctx: ContextoGuardRails): string[];
}

// ---------------------------------------------------------------------------
// Utilitários de texto
// ---------------------------------------------------------------------------

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function escaparRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Casa o termo como palavra inteira, sem depender de `\b` (que erra com acento). */
function contemTermo(texto: string, termo: string): boolean {
  const re = new RegExp(
    `(?<![\\p{L}\\p{N}])${escaparRegex(termo)}(?![\\p{L}\\p{N}])`,
    "iu",
  );
  return re.test(texto);
}

export function contarParagrafos(corpoMd: string): number {
  return corpoMd
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0).length;
}

// ---------------------------------------------------------------------------
// Extração de números
// ---------------------------------------------------------------------------

/**
 * Numerais por extenso em inglês. Sem isto, o original "twelve bishops" contra
 * o adaptado "12 bispos" seria acusado de número inventado — reprovação
 * correta pelo critério, errada pelo mérito.
 */
const NUMERAIS_EN: Readonly<Record<string, number>> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90, hundred: 100, thousand: 1000, million: 1000000,
  billion: 1000000000, dozen: 12,
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7,
  eighth: 8, ninth: 9, tenth: 10,
};

const DEZENAS_EN = ["twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const UNIDADES_EN = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

/** Grupos de dígitos, tolerando separador de milhar e decimal de qualquer idioma. */
const RE_NUMERO =
  /\d{1,3}(?:[.,\u00a0\u202f ]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?/g;

/**
 * Normaliza para comparação entre idiomas: remove TODO separador.
 * "1,234" (en) e "1.234" (pt) viram "1234"; "3.5" e "3,5" viram "35".
 *
 * Limitação assumida: "3.5" e "35" colidem. É uma janela estreita de
 * falso-negativo, aceita porque a alternativa (tentar adivinhar a convenção
 * decimal de cada idioma) gera falso-POSITIVO em massa, e falso-positivo aqui
 * significa reprovar matéria correta.
 */
function normalizarNumero(bruto: string): string {
  return bruto.replace(/[.,\u00a0\u202f ]/g, "").replace(/^0+(?=\d)/, "");
}

function numerosDoTexto(texto: string): Set<string> {
  // Marcadores de lista ordenada não são fatos.
  const limpo = texto
    .replace(/^\s{0,3}\d{1,3}[.)]\s+/gm, "")
    // URLs dentro de links markdown carregam dígitos que não são conteúdo.
    .replace(/\]\([^)]*\)/g, "]");

  const achados = new Set<string>();
  for (const m of limpo.matchAll(RE_NUMERO)) {
    achados.add(normalizarNumero(m[0]));
  }
  return achados;
}

/** Números do original: dígitos + numerais por extenso + compostos com hífen. */
function numerosPermitidos(original: string): Set<string> {
  const permitidos = numerosDoTexto(original);
  const baixo = original.toLowerCase();

  for (const [palavra, valor] of Object.entries(NUMERAIS_EN)) {
    if (contemTermo(baixo, palavra)) permitidos.add(String(valor));
  }
  for (const dezena of DEZENAS_EN) {
    for (const unidade of UNIDADES_EN) {
      const re = new RegExp(`\\b${dezena}[- ]${unidade}\\b`, "i");
      if (re.test(baixo)) {
        permitidos.add(String(NUMERAIS_EN[dezena] + NUMERAIS_EN[unidade]));
      }
    }
  }
  return permitidos;
}

// ---------------------------------------------------------------------------
// Detecção de idioma
// ---------------------------------------------------------------------------

/**
 * Listas escolhidas para NÃO ter interseção entre os dois idiomas. Palavras
 * como "a", "as", "e", "no", "por" existem nos dois (ou são ruído) e ficaram
 * de fora de propósito — a contagem só vale se cada acerto for inequívoco.
 */
const STOPWORDS_EN: readonly string[] = [
  "the", "and", "of", "to", "in", "is", "was", "were", "for", "with", "that",
  "said", "from", "have", "has", "had", "will", "this", "these", "those",
  "which", "been", "being", "their", "they", "them", "his", "her", "she",
  "he", "it", "its", "not", "but", "also", "after", "before", "during",
  "while", "would", "could", "should", "about", "more", "than", "who",
  "what", "when", "where", "there", "an", "at", "by", "if", "we", "you",
  "our", "your", "because", "through", "between", "against", "among",
];

const STOPWORDS_PT: readonly string[] = [
  "de", "que", "não", "com", "para", "uma", "um", "dos", "das", "pelo",
  "pela", "pelos", "pelas", "foi", "foram", "sobre", "também", "após",
  "seu", "sua", "seus", "suas", "este", "esta", "esse", "essa", "isso",
  "mas", "ainda", "já", "ser", "está", "são", "será", "do", "da", "na",
  "nas", "nos", "ao", "aos", "à", "às", "como", "quando", "onde", "porque",
  "durante", "desde", "até", "mesmo", "cada", "mais", "muito", "todos",
  "outra", "outro", "entre", "pelo", "havia", "disse", "segundo",
];

const RE_DIACRITICO = /[áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ]/g;

function contarStopwords(texto: string, lista: readonly string[]): number {
  const palavras = texto.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
  const conjunto = new Set(lista);
  let total = 0;
  for (const p of palavras) if (conjunto.has(p)) total += 1;
  return total;
}

export interface MedidaIdioma {
  stopwordsEn: number;
  stopwordsPt: number;
  razaoEn: number;
  densidadeDiacriticos: number;
}

export function medirIdioma(texto: string): MedidaIdioma {
  const en = contarStopwords(texto, STOPWORDS_EN);
  const pt = contarStopwords(texto, STOPWORDS_PT);
  const total = en + pt;
  const diacriticos = texto.match(RE_DIACRITICO)?.length ?? 0;
  return {
    stopwordsEn: en,
    stopwordsPt: pt,
    // Sem nenhuma stopword reconhecida não dá para afirmar que é PT-BR.
    // Razão 1 força reprovação — incerteza é reprovação.
    razaoEn: total === 0 ? 1 : en / total,
    densidadeDiacriticos:
      texto.length === 0 ? 0 : diacriticos / texto.length,
  };
}

// ---------------------------------------------------------------------------
// Marcadores de recusa / vazamento do modelo
// ---------------------------------------------------------------------------

/**
 * Sinais de que o que chegou não é matéria: é o modelo falando sobre si mesmo,
 * recusando a tarefa, ou vazando o andaime da resposta.
 */
const MARCADORES_RECUSA: readonly { re: RegExp; rotulo: string }[] = [
  { re: /\bI(?:'|’)?m sorry\b/i, rotulo: "I'm sorry" },
  { re: /\bI am sorry\b/i, rotulo: "I am sorry" },
  { re: /\bI apologi[sz]e\b/i, rotulo: "I apologize" },
  { re: /\bas an AI\b/i, rotulo: "As an AI" },
  { re: /\bas a language model\b/i, rotulo: "as a language model" },
  { re: /\bI cannot\b/i, rotulo: "I cannot" },
  { re: /\bI can(?:'|’)?t\b/i, rotulo: "I can't" },
  { re: /\bI(?:'|’)?m unable\b/i, rotulo: "I'm unable" },
  { re: /\bI do not have\b/i, rotulo: "I do not have" },
  { re: /\bhere(?:'|’)?s the\b/i, rotulo: "Here's the" },
  { re: /\bhere is the (?:adapted|translated|article|rewritten)\b/i, rotulo: "Here is the ..." },
  { re: /\bsure[,!]\s/i, rotulo: "Sure, ..." },
  { re: /como (?:uma? )?(?:IA|inteligência artificial)\b/i, rotulo: "como uma IA" },
  { re: /modelo de linguagem/i, rotulo: "modelo de linguagem" },
  { re: /(?:desculpe|sinto muito)[,.]?\s+(?:mas\s+)?não posso/i, rotulo: "desculpe, não posso" },
  { re: /não posso (?:ajudar|atender|realizar|fazer isso)/i, rotulo: "não posso ajudar" },
  { re: /\bclaro[,!]\s+(?:aqui|segue)/i, rotulo: "Claro, aqui está" },
  { re: /```/, rotulo: "cerca de código (```)" },
  { re: /<\|[a-z_]+\|>/i, rotulo: "token especial do modelo" },
  { re: /^\s*(?:assistant|system|user)\s*:/im, rotulo: "rótulo de turno de chat" },
  { re: /"corpo_md"\s*:/i, rotulo: "JSON da resposta vazou para o corpo" },
];

// ---------------------------------------------------------------------------
// As regras
// ---------------------------------------------------------------------------

const REGRAS: readonly RegraGuardRail[] = [
  // -------------------------------------------------------------------------
  {
    id: "comprimento",
    descricao: "Corpo, título, dek e contagem de parágrafos dentro dos limites",
    avaliar(ctx) {
      const erros: string[] = [];
      const corpo = ctx.corpoMd.trim();

      if (corpo.length === 0) {
        return ["comprimento: corpo adaptado vazio."];
      }
      if (corpo.length < LIMITES.MIN_CHARS_CORPO) {
        erros.push(
          `comprimento: corpo com ${corpo.length} caracteres, mínimo ${LIMITES.MIN_CHARS_CORPO}.`,
        );
      }
      if (corpo.length > LIMITES.MAX_CHARS_CORPO) {
        erros.push(
          `comprimento: corpo com ${corpo.length} caracteres, máximo ${LIMITES.MAX_CHARS_CORPO}.`,
        );
      }

      const paragrafos = contarParagrafos(corpo);
      if (paragrafos < LIMITES.MIN_PARAGRAFOS) {
        erros.push(
          `comprimento: ${paragrafos} parágrafo(s), mínimo ${LIMITES.MIN_PARAGRAFOS}.`,
        );
      }
      if (paragrafos > LIMITES.MAX_PARAGRAFOS) {
        erros.push(
          `comprimento: ${paragrafos} parágrafos, máximo ${LIMITES.MAX_PARAGRAFOS}.`,
        );
      }

      const titulo = ctx.titulo.trim();
      if (
        titulo.length < LIMITES.MIN_CHARS_TITULO ||
        titulo.length > LIMITES.MAX_CHARS_TITULO
      ) {
        erros.push(
          `comprimento: título com ${titulo.length} caracteres, esperado entre ${LIMITES.MIN_CHARS_TITULO} e ${LIMITES.MAX_CHARS_TITULO}.`,
        );
      }

      const dek = ctx.dek.trim();
      if (
        dek.length < LIMITES.MIN_CHARS_DEK ||
        dek.length > LIMITES.MAX_CHARS_DEK
      ) {
        erros.push(
          `comprimento: dek com ${dek.length} caracteres, esperado entre ${LIMITES.MIN_CHARS_DEK} e ${LIMITES.MAX_CHARS_DEK}.`,
        );
      }

      if (
        ctx.tags.length < LIMITES.MIN_TAGS ||
        ctx.tags.length > LIMITES.MAX_TAGS
      ) {
        erros.push(
          `comprimento: ${ctx.tags.length} tag(s), esperado entre ${LIMITES.MIN_TAGS} e ${LIMITES.MAX_TAGS}.`,
        );
      }

      return erros;
    },
  },

  // -------------------------------------------------------------------------
  {
    id: "proporcao",
    descricao:
      "Adaptado entre o piso e o teto de proporção sobre o original (anti-republicação)",
    avaliar(ctx) {
      const corpo = ctx.corpoMd.trim();

      // Sem saber o tamanho do original não há como provar que isto não é
      // republicação. Não dá para deixar passar "no benefício da dúvida".
      if (
        !Number.isFinite(ctx.comprimentoOriginal) ||
        ctx.comprimentoOriginal <= 0
      ) {
        return [
          "proporcao: sourceLength ausente ou zero — impossível provar que o texto não é republicação do original. A ingestão precisa preencher articles.source_length.",
        ];
      }

      // Base = o MENOR entre o comprimento declarado do original e o texto que
      // efetivamente alimentou o modelo. Se a ingestão só conseguiu um excerpt,
      // é dele que o texto poderia ter sido copiado — e é contra ele que a
      // proporção precisa ser medida. Usar o comprimento do artigo completo
      // afrouxaria o teto e apertaria o piso, os dois para o lado errado.
      const disponivel = ctx.textoOriginal.trim().length;
      const base =
        disponivel > 0
          ? Math.min(ctx.comprimentoOriginal, disponivel)
          : ctx.comprimentoOriginal;

      const razao = corpo.length / base;
      const pct = (razao * 100).toFixed(1);

      if (razao > LIMITES.TETO_PROPORCAO) {
        return [
          `proporcao: adaptado tem ${pct}% do original (${corpo.length}/${base} caracteres), acima do teto de ${(LIMITES.TETO_PROPORCAO * 100).toFixed(0)}% — republicação disfarçada.`,
        ];
      }
      if (razao < LIMITES.PISO_PROPORCAO) {
        return [
          `proporcao: adaptado tem só ${pct}% do original (${corpo.length}/${base} caracteres), abaixo do piso de ${(LIMITES.PISO_PROPORCAO * 100).toFixed(0)}% — é chamada, não matéria.`,
        ];
      }
      return [];
    },
  },

  // -------------------------------------------------------------------------
  {
    id: "atribuicao",
    descricao: "sourceName e sourceUrl presentes, absolutos e no host da fonte",
    avaliar(ctx) {
      const erros: string[] = [];

      if (ctx.sourceName.trim().length === 0) {
        erros.push("atribuicao: sourceName vazio — o bloco \"Fonte: X\" não pode ser montado.");
      }

      const url = ctx.sourceUrl.trim();
      if (url.length === 0) {
        erros.push("atribuicao: sourceUrl vazio — sem link canônico de volta.");
        return erros;
      }

      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        erros.push(`atribuicao: sourceUrl não é uma URL absoluta válida ("${url}").`);
        return erros;
      }

      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        erros.push(`atribuicao: sourceUrl com protocolo inesperado "${parsed.protocol}".`);
      }

      const permitidos = HOSTS_POR_FONTE[ctx.fonte];
      const host = parsed.hostname.toLowerCase();
      const ok = permitidos.some((h) => host === h || host.endsWith(`.${h}`));
      if (!ok) {
        erros.push(
          `atribuicao: host "${host}" não pertence à fonte "${ctx.fonte}" (esperado: ${permitidos.join(", ")}).`,
        );
      }

      return erros;
    },
  },

  // -------------------------------------------------------------------------
  {
    id: "numeros",
    descricao: "Nenhum número no adaptado que não exista no original",
    avaliar(ctx) {
      // Direção da checagem, deliberada: NÃO exigimos que todo número do
      // original apareça no adaptado — a matéria tem 40–50% do tamanho e
      // legitimamente descarta detalhe. Exigimos o contrário: que nada
      // numérico apareça do nada. Número que surge sem estar no original é
      // invenção, e invenção é o modo de falha que mais assusta aqui.
      const permitidos = numerosPermitidos(ctx.textoOriginal);
      const usados = numerosDoTexto(`${ctx.titulo}\n\n${ctx.dek}\n\n${ctx.corpoMd}`);

      const inventados = [...usados].filter((n) => !permitidos.has(n));
      if (inventados.length === 0) return [];

      return [
        `numeros: valor(es) ausente(s) do original: ${inventados.slice(0, 10).join(", ")}.`,
      ];
    },
  },

  // -------------------------------------------------------------------------
  {
    id: "verificacao_factual",
    descricao: "Veredito estruturado do checador adversarial",
    avaliar(ctx) {
      // Ausência de veredito NUNCA é aprovação. Ver provider.ts.
      if (ctx.verificacao === null) {
        return [
          "verificacao_factual: checagem factual não foi produzida — sem veredito, não há como certificar o texto.",
        ];
      }

      const { consistente, divergencias } = ctx.verificacao;

      // Contradição interna do modelo ("consistente" com divergências listadas)
      // é justamente o tipo de saída confusa que um modelo pequeno produz.
      // Tratamos como reprovação, não como ruído a ignorar.
      if (divergencias.length > 0) {
        const lista = divergencias
          .slice(0, 6)
          .map((d) => d.trim().slice(0, LIMITES.MAX_CHARS_POR_ERRO))
          .filter((d) => d.length > 0);
        return [
          `verificacao_factual: ${divergencias.length} divergência(s) apontada(s) pelo checador: ${lista.join(" | ")}`,
        ];
      }

      if (!consistente) {
        return [
          "verificacao_factual: checador reprovou o texto sem detalhar a divergência.",
        ];
      }

      return [];
    },
  },

  // -------------------------------------------------------------------------
  {
    id: "idioma",
    descricao: "Saída em PT-BR, não em inglês",
    avaliar(ctx) {
      // Falha clássica de modelo pequeno: ignorar a instrução de idioma e
      // devolver o original em inglês, ou traduzir só o título.
      const alvo = `${ctx.titulo}\n\n${ctx.dek}\n\n${ctx.corpoMd}`;
      const m = medirIdioma(alvo);
      const erros: string[] = [];

      if (m.razaoEn > LIMITES.MAX_RAZAO_STOPWORDS_EN) {
        erros.push(
          `idioma: texto parece estar em inglês (${m.stopwordsEn} marcadores EN contra ${m.stopwordsPt} PT; razão ${m.razaoEn.toFixed(2)} > ${LIMITES.MAX_RAZAO_STOPWORDS_EN}).`,
        );
      }
      if (m.densidadeDiacriticos < LIMITES.MIN_DENSIDADE_DIACRITICOS) {
        erros.push(
          `idioma: densidade de acentos ${m.densidadeDiacriticos.toFixed(4)} abaixo do piso ${LIMITES.MIN_DENSIDADE_DIACRITICOS} — prosa em PT-BR não fica sem acento.`,
        );
      }
      return erros;
    },
  },

  // -------------------------------------------------------------------------
  {
    id: "recusa_do_modelo",
    descricao: "Sem marcador de recusa, desculpa ou vazamento de andaime",
    avaliar(ctx) {
      const alvo = `${ctx.titulo}\n${ctx.dek}\n${ctx.corpoMd}`;
      const achados = MARCADORES_RECUSA.filter((m) => m.re.test(alvo)).map(
        (m) => m.rotulo,
      );
      if (achados.length === 0) return [];
      return [
        `recusa_do_modelo: marcador(es) de saída não-editorial no texto: ${achados.join(", ")}.`,
      ];
    },
  },

  // -------------------------------------------------------------------------
  {
    id: "rito_1962",
    descricao: "Sem terminologia do Novus Ordo fabricada pelo modelo",
    avaliar(ctx) {
      // Regra fina de propósito. Noticiar uma celebração no Novus Ordo é
      // legítimo — se a FONTE usou o termo, usá-lo é reportagem correta. O que
      // se barra é o modelo "corrigir" a terminologia de 1962 para a moderna
      // por conta própria, o que seria fabricação litúrgica num portal que
      // segue o missal de 1962 (MEMORY.md §2.5).
      const adaptado = semAcento(
        `${ctx.titulo}\n${ctx.dek}\n${ctx.corpoMd}`,
      ).toLowerCase();
      const original = ctx.textoOriginal.toLowerCase();
      const erros: string[] = [];

      for (const veto of TERMOS_NOVUS_ORDO_VETADOS) {
        const alvo = semAcento(veto.pt).toLowerCase();
        if (!adaptado.includes(alvo)) continue;
        const absolvido = veto.origemLegitima.some((o) =>
          original.includes(o.toLowerCase()),
        );
        if (absolvido) continue;
        erros.push(`rito_1962: "${veto.pt}" sem respaldo no original. ${veto.motivo}`);
      }
      return erros;
    },
  },

  // -------------------------------------------------------------------------
  {
    id: "glossario",
    descricao: "Termos que exigem tradução não podem ficar em inglês",
    avaliar(ctx) {
      const alvo = `${ctx.titulo}\n${ctx.dek}\n${ctx.corpoMd}`;
      const naoTraduzidos = TERMOS_QUE_EXIGEM_TRADUCAO.filter((e) =>
        contemTermo(alvo, e.en),
      ).map((e) => `"${e.en}" (deveria ser "${e.pt}")`);

      if (naoTraduzidos.length === 0) return [];
      return [
        `glossario: termo(s) deixado(s) em inglês: ${naoTraduzidos.slice(0, 8).join(", ")}.`,
      ];
    },
  },
];

// ---------------------------------------------------------------------------
// Avaliação
// ---------------------------------------------------------------------------

/**
 * Roda TODAS as regras — não para na primeira falha.
 *
 * Motivo: sem revisor humano, `validationErrors` é o único relatório que
 * alguém vai ler ao investigar por que um artigo não subiu. Um erro por vez
 * transformaria o diagnóstico em N execuções de cron.
 */
export function avaliarGuardRails(
  ctx: ContextoGuardRails,
): ResultadoGuardRails {
  const erros: string[] = [];
  const regrasReprovadas: string[] = [];

  for (const regra of REGRAS) {
    let achados: string[];
    try {
      achados = regra.avaliar(ctx);
    } catch (e) {
      // Regra que explode não pode virar aprovação silenciosa.
      achados = [
        `${regra.id}: a própria checagem falhou (${e instanceof Error ? e.message : String(e)}) — reprovado por precaução.`,
      ];
    }
    if (achados.length > 0) {
      regrasReprovadas.push(regra.id);
      erros.push(...achados);
    }
  }

  const truncados = erros
    .slice(0, LIMITES.MAX_ERROS_REGISTRADOS)
    .map((e) => (e.length > LIMITES.MAX_CHARS_POR_ERRO ? `${e.slice(0, LIMITES.MAX_CHARS_POR_ERRO)}…` : e));

  if (erros.length > LIMITES.MAX_ERROS_REGISTRADOS) {
    truncados.push(
      `(+${erros.length - LIMITES.MAX_ERROS_REGISTRADOS} erro(s) omitido(s))`,
    );
  }

  return {
    aprovado: erros.length === 0,
    erros: truncados,
    regrasReprovadas,
  };
}

/** Ids de todas as regras, na ordem de execução. Para documentação e testes. */
export const IDS_REGRAS: readonly string[] = REGRAS.map((r) => r.id);

// ---------------------------------------------------------------------------
// Pré-voo — antes de gastar Neurons
// ---------------------------------------------------------------------------

export interface ResultadoPreVoo {
  adaptavel: boolean;
  motivo?: string;
}

/**
 * Decide se vale a pena chamar o modelo.
 *
 * Um item cujo texto original é curto demais nunca produziria um corpo
 * aprovável sem invenção — chamar o modelo para ele é queimar cota do dia para
 * receber uma reprovação garantida. Com 10.000 Neurons/dia, isso importa.
 */
export function preVoo(
  textoOriginal: string,
  comprimentoOriginal: number,
): ResultadoPreVoo {
  const texto = textoOriginal.trim();

  if (texto.length === 0) {
    return {
      adaptavel: false,
      motivo:
        "pre_voo: texto original ausente — a ingestão não guardou corpo nem excerpt utilizável.",
    };
  }
  if (texto.length < MIN_CHARS_ORIGINAL) {
    return {
      adaptavel: false,
      motivo: `pre_voo: texto original com ${texto.length} caracteres; são necessários ao menos ${MIN_CHARS_ORIGINAL} para que ${(LIMITES.ALVO_PROPORCAO_MIN * 100).toFixed(0)}% dele chegue aos ${LIMITES.MIN_CHARS_CORPO} caracteres mínimos de corpo. Adaptar a partir deste texto exigiria inventar.`,
    };
  }
  if (!Number.isFinite(comprimentoOriginal) || comprimentoOriginal <= 0) {
    return {
      adaptavel: false,
      motivo:
        "pre_voo: sourceLength ausente ou zero — sem ele o teto de proporção não pode ser verificado.",
    };
  }
  return { adaptavel: true };
}
