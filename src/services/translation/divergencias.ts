import { GLOSSARIO } from "./glossary";

/**
 * Filtro ESTRUTURAL de divergências do checador factual.
 *
 * ## O problema que este arquivo resolve
 *
 * Medido em produção (30/07): de 55 tentativas de adaptação num dia — o teto da
 * cota gratuita — **34 foram reprovadas**, a esmagadora maioria por
 * `verificacao_factual`. Inspecionando as divergências, os dois tipos estavam
 * misturados:
 *
 * ```
 * REAL:  "Desde a Guerra da Independência"
 *          ← original: "From the battlefields of the Civil War"
 * RUÍDO: "a freira Leticia Ugboaja"  ← original: "Sister Leticia Ugboaja"
 * RUÍDO: "Papa Francisco o declarou beato"
 *          ← original: "Pope Francis declared him blessed"
 * ```
 *
 * O filtro lexical que já existia (`RE_RUIDO_DE_TRADUCAO`, em `prompt.ts`)
 * procura o checador *se explicando* — "formato de data", "apenas tradução".
 * Estas divergências não explicam nada: só justapõem os dois trechos. Não há o
 * que casar por palavra.
 *
 * O custo do falso positivo é DUPLO e é o que torna isto prioritário: cada um
 * gasta duas chamadas de modelo (adaptar + verificar) da cota escassa **e**
 * perde um artigo bom.
 *
 * ## O sinal discriminante
 *
 * Comparar os **tokens duros** dos dois trechos citados — números, datas e
 * nomes próprios. É exatamente o que o `CLAUDE.md` §1 protege, e é computável
 * sem gastar Neuron nenhum:
 *
 * - `"Sister Leticia Ugboaja"` → `{Leticia, Ugboaja}`; o adaptado tem os dois.
 * - `"Leo XIV"` → `{Leo, XIV}`; o adaptado ("Papa Leo XIV") tem os dois.
 * - `"the Civil War"` → `{Civil, War}`; o adaptado ("Guerra da Independência")
 *   não tem `Civil` → **divergência real, mantida.**
 *
 * ## Custo consciente desta escolha
 *
 * Perde-se nuance sem token duro: `"in the fall of 2027"` → `"a partir de
 * 2027"` passa a escapar, porque o ano bate. É perda de precisão, não fato
 * falso — e o preço de barrar isso era reprovar metade da produção.
 *
 * A exceção é NEGAÇÃO, tratada à parte: "negou" ↔ "afirmou" não tem token duro
 * nenhum e inverte o sentido. Ver `negacaoDivergente()`.
 *
 * ## Postura de falha
 *
 * Se a divergência não for parseável nos dois trechos, ela **não** é tratada
 * como ruído — segue reprovando. Fail-closed: na dúvida, não publica.
 */

// ---------------------------------------------------------------------------
// Normalização
// ---------------------------------------------------------------------------

/** Minúsculas, sem acento e sem pontuação de borda. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

// ---------------------------------------------------------------------------
// Palavras que NÃO são token duro
// ---------------------------------------------------------------------------

/**
 * Títulos e tratamentos. São justamente o que a tradução troca de forma
 * legítima ("Sister" → "freira", "Pope" → "Papa"), e nenhum deles carrega fato.
 */
const TITULOS = new Set(
  [
    "pope", "papa", "pontiff", "pontifice", "sister", "irma", "freira",
    "soror", "father", "padre", "pe", "frei", "brother", "irmao", "mother",
    "madre", "cardinal", "cardeal", "bishop", "bispo", "archbishop",
    "arcebispo", "monsignor", "monsenhor", "msgr", "rev", "reverend",
    "reverendo", "dom", "dona", "saint", "st", "sao", "santo", "santa",
    "blessed", "beato", "beata", "venerable", "veneravel", "servant", "servo",
    "emeritus", "emerito", "fr", "sr", "sra", "mr", "ms", "mrs", "dr", "prof",
    "professor", "professora", "deacon", "diacono", "abbot", "abade", "prior",
    "priora", "nuncio", "nuncia", "primaz", "primate",
  ].map(normalizar),
);

/**
 * Gramaticais. Entram na lista porque um trecho citado pode começar com
 * maiúscula por estar no início da frase, não por ser nome próprio.
 */
const GRAMATICAIS = new Set(
  [
    "the", "a", "an", "of", "in", "on", "at", "from", "to", "and", "or", "for",
    "with", "by", "as", "that", "this", "these", "those", "his", "her", "its",
    "their", "he", "she", "it", "they", "was", "were", "is", "are", "has",
    "have", "had", "will", "would", "o", "os", "um", "uma", "uns", "umas",
    "de", "do", "da", "dos", "das", "em", "no", "na", "nos", "nas", "e", "ou",
    "que", "com", "por", "para", "ao", "aos", "pela", "pelo", "seu", "sua",
    "seus", "suas", "ele", "ela", "eles", "elas", "foi", "foram", "sera",
    "durante", "apos", "antes", "sobre", "entre", "desde", "ate",
  ].map(normalizar),
);

// ---------------------------------------------------------------------------
// Meses — comparados por índice, não por palavra
// ---------------------------------------------------------------------------

/**
 * Data é fato, e o nome do mês é a parte da data que a tradução reescreve por
 * inteiro ("August 4" → "4 de agosto"). Comparar como palavra daria divergência
 * em toda data; ignorar deixaria passar "August" → "setembro". Comparar o
 * ÍNDICE resolve os dois.
 *
 * As formas abreviadas do inglês entram porque as fontes usam estilo AP
 * ("Aug. 4–5"). Maio/junho/julho não abreviam em AP, daí a lista assimétrica.
 */
const MESES: ReadonlyMap<string, number> = new Map(
  Object.entries({
    january: 1, jan: 1, janeiro: 1,
    february: 2, feb: 2, fevereiro: 2,
    march: 3, mar: 3, marco: 3,
    april: 4, apr: 4, abril: 4,
    may: 5, maio: 5,
    june: 6, jun: 6, junho: 6,
    july: 7, jul: 7, julho: 7,
    august: 8, aug: 8, agosto: 8,
    september: 9, sept: 9, sep: 9, setembro: 9,
    october: 10, oct: 10, outubro: 10,
    november: 11, nov: 11, novembro: 11,
    december: 12, dec: 12, dezembro: 12,
  }),
);

// ---------------------------------------------------------------------------
// Equivalências EN ↔ PT
// ---------------------------------------------------------------------------

/**
 * Pares derivados do glossário — **apenas** entradas de uma palavra de cada
 * lado.
 *
 * O corte é deliberado. "St. Francis of Assisi" → "São Francisco de Assis"
 * casaria palavra a palavra e acabaria declarando `Assisi ≡ Francisco`, o que
 * tornaria o filtro cego a troca de nome. Entrada de uma palavra não tem essa
 * ambiguidade.
 *
 * O glossário segue sendo a fonte de verdade da TRADUÇÃO; isto aqui é só a
 * tabela de COMPARAÇÃO, e por isso pode ser mais conservadora que ele.
 */
function derivarDoGlossario(): ReadonlyMap<string, string> {
  const mapa = new Map<string, string>();
  for (const entrada of GLOSSARIO) {
    const en = normalizar(entrada.en);
    const pt = normalizar(entrada.pt);
    if (en.includes(" ") || pt.includes(" ")) continue;
    if (en.length === 0 || pt.length === 0) continue;
    mapa.set(en, pt);
  }
  return mapa;
}

/**
 * O que o glossário não cobre porque não é terminologia católica: prenomes com
 * forma consagrada diferente e topônimos. Sem isto, "Pope Leo XIV" → "Papa Leão
 * XIV" seria lido como troca de nome.
 *
 * Só entram pares em que o prefixo NÃO resolve sozinho — `Francis/Francisco` e
 * `Rome/Roma` já casam por prefixo e ficam de fora de propósito, para a tabela
 * não virar depósito.
 */
const EQUIVALENCIAS_EXTRAS: ReadonlyMap<string, string> = new Map(
  Object.entries({
    john: "joao", leo: "leao", benedict: "bento", paul: "paulo",
    peter: "pedro", james: "tiago", stephen: "estevao", michael: "miguel",
    joseph: "jose", mary: "maria", matthew: "mateus", luke: "lucas",
    mark: "marcos", andrew: "andre", philip: "felipe", charles: "carlos",
    louis: "luis", lawrence: "lourenco", gregory: "gregorio",
    jerome: "jeronimo", ignatius: "inacio", dominic: "domingos",
    anthony: "antonio", elizabeth: "isabel", catherine: "catarina",
    germany: "alemanha", poland: "polonia", england: "inglaterra",
    spain: "espanha", italy: "italia", greece: "grecia", ireland: "irlanda",
    switzerland: "suica", netherlands: "holanda", "united-states": "eua",
    holland: "holanda", turkey: "turquia", egypt: "egito", israel: "israel",
    lebanon: "libano", syria: "siria", nigeria: "nigeria", kenya: "quenia",
    china: "china", japan: "japao", korea: "coreia", india: "india",
  }),
);

const DO_GLOSSARIO = derivarDoGlossario();

/** Índice bidirecional: dado um token, o conjunto das formas equivalentes. */
const EQUIVALENTES: ReadonlyMap<string, ReadonlySet<string>> = (() => {
  const mapa = new Map<string, Set<string>>();
  const ligar = (a: string, b: string): void => {
    if (a === b) return;
    for (const [x, y] of [
      [a, b],
      [b, a],
    ] as const) {
      const grupo = mapa.get(x) ?? new Set<string>();
      grupo.add(y);
      mapa.set(x, grupo);
    }
  };
  for (const [en, pt] of DO_GLOSSARIO) ligar(en, pt);
  for (const [en, pt] of EQUIVALENCIAS_EXTRAS) ligar(en, pt);
  return mapa;
})();

// ---------------------------------------------------------------------------
// Extração dos dois trechos citados
// ---------------------------------------------------------------------------

/**
 * O checador emite `"<adaptado>" — o original dizia "<original>"`. Aceita as
 * variantes de travessão e de verbo que os modelos produzem na prática.
 */
const RE_PAR_EXPLICITO =
  /["“]([^"”“]{2,400})["”]\s*[—–-]\s*(?:no|o)?\s*original\s+(?:dizia|diz|era|traz|afirma)\s*:?\s*["“]([^"”“]{2,400})["”]/i;

/** Qualquer trecho entre aspas retas ou curvas. */
const RE_ASPAS = /["“]([^"”“]{2,400})["”]/g;

interface ParCitado {
  adaptado: string;
  original: string;
}

export function extrairParCitado(divergencia: string): ParCitado | null {
  const explicito = RE_PAR_EXPLICITO.exec(divergencia);
  if (explicito?.[1] && explicito[2]) {
    return { adaptado: explicito[1], original: explicito[2] };
  }

  // Reserva: exatamente dois trechos entre aspas, na ordem adaptado → original,
  // que é a ordem que o prompt pede. Com três ou mais não dá para saber quem é
  // quem, e chutar aqui seria deixar passar erro factual.
  const todos = [...divergencia.matchAll(RE_ASPAS)].map((m) => m[1] ?? "");
  if (todos.length === 2 && todos[0] && todos[1]) {
    return { adaptado: todos[0], original: todos[1] };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Tokens duros
// ---------------------------------------------------------------------------

interface TokensDuros {
  /** Números já sem separador de milhar. */
  numeros: ReadonlySet<string>;
  /** Meses por índice 1–12. */
  meses: ReadonlySet<number>;
  /** Nomes próprios normalizados. */
  nomes: ReadonlySet<string>;
}

/**
 * Separador de milhar difere entre as línguas — `1,000` em inglês é `1.000` em
 * português. Sem normalizar, todo número grande viraria divergência.
 */
function normalizarNumeros(fragmento: string): string[] {
  const semSeparador = fragmento.replace(/(\d)[.,](?=\d{3}\b)/g, "$1");
  return [...semSeparador.matchAll(/\d+/g)].map((m) => m[0].replace(/^0+(?=\d)/, ""));
}

export function tokensDuros(fragmento: string): TokensDuros {
  const numeros = new Set(normalizarNumeros(fragmento));

  const palavras = fragmento.split(/[\s,;:()[\]{}"“”'’]+/).filter(Boolean);

  const meses = new Set<number>();
  const nomes = new Set<string>();

  for (const bruta of palavras) {
    const chave = normalizar(bruta);
    if (chave.length === 0) continue;

    const mes = MESES.get(chave);
    if (mes !== undefined) {
      meses.add(mes);
      continue;
    }

    if (TITULOS.has(chave) || GRAMATICAIS.has(chave)) continue;

    // Só nome próprio: começa com maiúscula, ou é algarismo romano (Leão XIV).
    const ehMaiuscula = /^\p{Lu}/u.test(bruta);
    const ehRomano = /^[IVXLCDM]{1,7}$/.test(bruta.replace(/[.,]/g, ""));
    if (!ehMaiuscula && !ehRomano) continue;

    // Palavra de uma letra é inicial ou ruído de pontuação, não fato.
    if (chave.length < 2) continue;

    nomes.add(chave);
  }

  return { numeros, meses, nomes };
}

// ---------------------------------------------------------------------------
// Comparação
// ---------------------------------------------------------------------------

/** Prefixo comum que basta para tratar dois nomes como o mesmo. */
const PREFIXO_MINIMO = 4;

/**
 * Cognato: `Vatican`/`Vaticano`, `Francis`/`Francisco`, `Jerusalem`/`Jerusalém`.
 * Quatro caracteres é o menor prefixo que não colide na prática entre os nomes
 * próprios que aparecem em notícia da Igreja — três já casaria `Roma`/`Romero`.
 */
function ehCognato(a: string, b: string): boolean {
  const minimo = Math.min(a.length, b.length);
  if (minimo < PREFIXO_MINIMO) return false;
  return a.slice(0, PREFIXO_MINIMO) === b.slice(0, PREFIXO_MINIMO);
}

function nomeTemCorrespondente(
  nome: string,
  candidatos: ReadonlySet<string>,
): boolean {
  if (candidatos.has(nome)) return true;

  const equivalentes = EQUIVALENTES.get(nome);
  if (equivalentes) {
    for (const alternativa of equivalentes) {
      if (candidatos.has(alternativa)) return true;
    }
  }

  for (const candidato of candidatos) {
    if (ehCognato(nome, candidato)) return true;
  }

  return false;
}

function todosPresentes(
  origem: ReadonlySet<string>,
  destino: ReadonlySet<string>,
): boolean {
  for (const nome of origem) {
    if (!nomeTemCorrespondente(nome, destino)) return false;
  }
  return true;
}

function conjuntosIguais<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) if (!b.has(item)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Negação
// ---------------------------------------------------------------------------

const RE_NEGACAO =
  /\b(n[ãa]o|nunca|jamais|nenhum|nenhuma|sem|negou|nega|negado|recusou|recusa|rejeitou|rejeita|proibiu|proibe|not|never|no|none|without|denied|denies|refused|refuses|rejected|rejects|banned|bans)\b/i;

/**
 * Inversão de sentido não deixa rastro em token duro: "negou" e "afirmou" têm
 * zero número e zero nome próprio, e trocar um pelo outro inverte a notícia.
 * Este é o único caso em que a ausência de token duro **não** significa ruído.
 */
export function negacaoDivergente(par: ParCitado): boolean {
  return RE_NEGACAO.test(par.adaptado) !== RE_NEGACAO.test(par.original);
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/**
 * `true` quando a divergência é apenas a tradução fazendo o trabalho dela.
 *
 * Fail-closed em toda saída incerta: divergência que não dá para parsear, ou
 * que muda número, data, nome próprio ou polaridade, devolve `false` e segue
 * reprovando o artigo.
 */
export function ehRuidoEstrutural(divergencia: string): boolean {
  const par = extrairParCitado(divergencia);
  if (par === null) return false;

  if (negacaoDivergente(par)) return false;

  const adaptado = tokensDuros(par.adaptado);
  const original = tokensDuros(par.original);

  // Número e mês são comparados nos DOIS sentidos: número que some do adaptado é
  // perda, número que aparece só nele é invenção. Ambos reprovam.
  if (!conjuntosIguais(adaptado.numeros, original.numeros)) return false;
  if (!conjuntosIguais(adaptado.meses, original.meses)) return false;

  // Nomes também nos dois sentidos, com equivalência e cognato.
  if (!todosPresentes(original.nomes, adaptado.nomes)) return false;
  if (!todosPresentes(adaptado.nomes, original.nomes)) return false;

  return true;
}
