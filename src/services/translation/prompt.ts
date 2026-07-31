/**
 * Montagem de prompt e parsing de resposta.
 *
 * Separado dos providers de propósito: o texto que instrui o modelo é a peça
 * mais delicada da adaptação e precisa ser lida, revisada e versionada como
 * conteúdo editorial — não escondida dentro de uma função de infraestrutura.
 * Trocar `workersAi` por `anthropic` não deve mudar uma vírgula deste arquivo.
 *
 * Regra que atravessa tudo aqui: o modelo responde JSON, sempre. Nunca prosa
 * livre para nada que precise ser julgado ou armazenado em campo estruturado.
 */

import { CATEGORIAS } from "@/lib/categories";
import { z } from "zod";
import {
  montarBlocoGlossario,
  montarBlocoVetosRito1962,
  TIPOS_NUCLEO,
} from "./glossary";
import { ehRuidoEstrutural } from "./divergencias";
import { LIMITES } from "./guardrails";
import type {
  PedidoAdaptacao,
  PedidoVerificacao,
  RespostaAdaptacao,
  VerificacaoFactual,
} from "./provider";

// ---------------------------------------------------------------------------
// Tipos de mensagem (agnósticos de provider)
// ---------------------------------------------------------------------------

export type PapelMensagem = "system" | "user";

export interface MensagemChat {
  role: PapelMensagem;
  content: string;
}

/**
 * JSON Schema mínimo que os dois providers entendem. Tipado à mão porque o tipo
 * `json_schema` do Workers AI é `any` — e `any` é proibido (CLAUDE.md §8).
 */
export interface EsquemaJsonObjeto {
  type: "object";
  properties: Record<string, EsquemaJsonPropriedade>;
  required: string[];
  additionalProperties?: boolean;
}

export interface EsquemaJsonPropriedade {
  type: "string" | "boolean" | "array" | "number";
  description?: string;
  enum?: string[];
  items?: { type: "string" };
}

const SLUGS_VALIDOS: readonly string[] = CATEGORIAS.map((c) => c.slug);

// ---------------------------------------------------------------------------
// Prompt de adaptação
// ---------------------------------------------------------------------------

const PCT_MIN = (LIMITES.ALVO_PROPORCAO_MIN * 100).toFixed(0);
const PCT_MAX = (LIMITES.ALVO_PROPORCAO_MAX * 100).toFixed(0);
const PCT_TETO = (LIMITES.TETO_PROPORCAO * 100).toFixed(0);

/**
 * Prompt do sistema da adaptação.
 *
 * É construído por função (e não constante de módulo) porque o bloco do
 * glossário é grande e só faz sentido pagá-lo em tokens quando a chamada vai
 * de fato acontecer. Com Workers AI não há prompt caching: cada chamada
 * re-tokeniza tudo isto e desconta da cota diária de 10.000 Neurons. Ver a
 * nota de custo em `glossary.ts`.
 */
export function montarSistemaAdaptacao(): string {
  return [
    "Você é editor de um portal católico brasileiro. Sua tarefa é escrever uma",
    "matéria ORIGINAL em português do Brasil a partir de uma notícia publicada",
    "em inglês por outro veículo.",
    "",
    "REGRAS INEGOCIÁVEIS",
    "",
    "1. NÃO TRADUZA. Reescreva. O texto final deve ser seu, com estrutura de",
    "   frase e ordem de informação próprias. Tradução literal frase a frase é",
    "   republicação e será rejeitada.",
    "",
    `2. TAMANHO: entre ${PCT_MIN}% e ${PCT_MAX}% do comprimento do original.`,
    `   Ultrapassar ${PCT_TETO}% invalida a matéria automaticamente.`,
    "",
    `3. ESTRUTURA: ${LIMITES.MIN_PARAGRAFOS} a 5 parágrafos. Registro`,
    "   jornalístico sóbrio, informativo, sem adjetivação devocional excessiva",
    "   e sem pregação. Você informa; não exorta.",
    "",
    "4. NUNCA INVENTE. Se o original não afirma, você não afirma. Isso vale",
    "   para número, data, cifra, local, cargo, nome próprio e citação. Não",
    "   preencha lacuna com conhecimento geral seu — mesmo que você tenha",
    "   certeza. Se o original é vago, o seu texto é vago.",
    "",
    "5. NÚMEROS: copie em algarismos exatamente os valores do original. NÃO",
    "   converta número por extenso em algarismo nem arredonde.",
    "",
    "6. CITAÇÕES: no máximo uma citação direta curta, entre aspas, se for",
    "   central à notícia. Traduza-a com fidelidade. Prefira discurso indireto.",
    "",
    "7. NÃO escreva bloco de fonte, crédito, link, assinatura ou data. Isso é",
    "   acrescentado depois, automaticamente.",
    "",
    "8. Escreva SOMENTE em português do Brasil. Nenhuma frase em inglês.",
    "",
    "TERMINOLOGIA CATÓLICA OBRIGATÓRIA",
    "",
    "Use estas equivalências. À esquerda o inglês, à direita a forma correta em",
    "português; entre parênteses, quando houver, a armadilha a evitar.",
    "",
    montarBlocoGlossario(TIPOS_NUCLEO),
    "",
    "RITO LITÚRGICO — ATENÇÃO",
    "",
    "Este portal segue o calendário e o missal romano de 1962 (missa",
    "tridentina). Os termos abaixo pertencem ao rito reformado de 1969 e NÃO",
    "podem ser usados por sua conta. Só apareçam se o próprio original em",
    "inglês os usar:",
    "",
    montarBlocoVetosRito1962(),
    "",
    "FORMATO DA RESPOSTA",
    "",
    // NÃO pedir JSON aqui. Medido contra os modelos reais do Workers AI
    // (Llama 3.1 8B e Llama 3.3 70B): pedir um corpo longo de Markdown dentro
    // de uma string JSON falha de forma sistemática — o modelo escreve
    // `"corpo_md":` e despeja markdown cru, com quebras de linha e aspas
    // internas sem escapar, produzindo JSON inválido. Os dois modelos erraram
    // no MESMO ponto, o que descartou capacidade como causa.
    //
    // Delimitadores de linha não têm problema de escape: o corpo pode conter
    // aspas, quebras e o que for, porque o parser corta por marcador.
    "Responda EXATAMENTE neste formato de blocos, sem texto antes ou depois e",
    "sem cercas de código. Cada marcador começa em uma linha nova:",
    "",
    "TITULO: <manchete em PT-BR, 18 a 130 caracteres, sem ponto final>",
    "DEK: <linha de apoio em PT-BR, 40 a 280 caracteres>",
    `CATEGORIA: <um destes slugs: ${SLUGS_VALIDOS.join(", ")}>`,
    `TAGS: <${LIMITES.MIN_TAGS} a ${LIMITES.MAX_TAGS} termos curtos em PT-BR, minúsculos, separados por vírgula>`,
    "CORPO:",
    "<o corpo em Markdown; parágrafos separados por linha em branco;",
    "sem títulos, sem listas, sem links. Vai até o fim da resposta.>",
  ].join("\n");
}

export function montarUsuarioAdaptacao(pedido: PedidoAdaptacao): string {
  return [
    `Veículo de origem: ${pedido.sourceName}`,
    `Categoria sugerida pela ingestão: ${pedido.categoriaAtual}`,
    `Comprimento do original: ${pedido.comprimentoOriginal} caracteres.`,
    `Comprimento alvo do seu corpo: entre ${pedido.alvoCaracteres.min} e ${pedido.alvoCaracteres.max} caracteres.`,
    "",
    "TÍTULO ORIGINAL:",
    pedido.tituloOriginal,
    "",
    "TEXTO ORIGINAL:",
    pedido.textoOriginal,
  ].join("\n");
}

export function montarMensagensAdaptacao(
  pedido: PedidoAdaptacao,
): MensagemChat[] {
  return [
    { role: "system", content: montarSistemaAdaptacao() },
    { role: "user", content: montarUsuarioAdaptacao(pedido) },
  ];
}

export const ESQUEMA_JSON_ADAPTACAO: EsquemaJsonObjeto = {
  type: "object",
  properties: {
    titulo: { type: "string", description: "Manchete em português do Brasil." },
    dek: { type: "string", description: "Linha de apoio em português do Brasil." },
    corpo_md: {
      type: "string",
      description: "Corpo da matéria em Markdown, em português do Brasil.",
    },
    categoria: {
      type: "string",
      description: "Slug da categoria editorial.",
      enum: [...SLUGS_VALIDOS],
    },
    tags: { type: "array", items: { type: "string" } },
  },
  required: ["titulo", "dek", "corpo_md", "categoria", "tags"],
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// Prompt de verificação — postura adversarial
// ---------------------------------------------------------------------------

/**
 * O checador NÃO recebe o glossário nem o prompt de adaptação.
 *
 * É intencional. Se ele visse a instrução que produziu o texto, tenderia a
 * confirmá-la — é o mesmo modelo, e modelos concordam consigo mesmos. Ele
 * recebe só os dois textos e uma ordem: procure o erro. A limitação de fundo
 * (juiz e réu são o mesmo modelo classe 8B) está documentada em `provider.ts`
 * e é compensada pelas checagens determinísticas de `guardrails.ts`.
 */
export function montarSistemaVerificacao(): string {
  return [
    "Você confere FATOS entre duas versões da mesma notícia.",
    "",
    "REGRA ZERO, acima de todas as outras: a versão em português é uma",
    "TRADUÇÃO ADAPTADA e mais curta. Traduzir NÃO é divergir. Se o único",
    "problema que você consegue apontar é que o texto está em português, ou",
    "mais curto, ou com as frases reorganizadas, então NÃO HÁ divergência e o",
    "veredito é CONSISTENTE.",
    "",
    "Você procura UMA coisa só: afirmação em português que CONTRADIZ o",
    "original, ou que o original não sustenta. Aponte TODA ocorrência de:",
    "",
    "  a) número, data, quantia, idade, ano ou percentual que apareça na versão",
    "     em português sem estar no original;",
    "  b) nome de pessoa, lugar, instituição, documento ou cargo que apareça na",
    "     versão em português sem estar no original;",
    "  c) afirmação, causa, consequência ou intenção atribuída a alguém que o",
    "     original não sustenta;",
    "  d) citação entre aspas que não corresponda a fala presente no original;",
    "  e) troca de identidade: papa, bispo, diocese, país ou data trocados.",
    "",
    "NUNCA aponte como divergência (exemplos reais que você NÃO deve reportar):",
    '  - "Papa Leão XIV alerta jovens" vs "Pope Leo XIV: Use AI prudently"',
    "    → é tradução e reescrita de manchete. CONSISTENTE.",
    '  - "nos dias 4 e 5 de agosto" vs "from Aug. 4–5"',
    "    → mesma data, formato diferente. CONSISTENTE.",
    '  - "Santa Sé" vs "Holy See"; "arcebispo" vs "archbishop"',
    "    → terminologia vertida para o português. CONSISTENTE.",
    "  - informação do original que ficou de fora (a versão é mais curta DE",
    "    PROPÓSITO — omitir é o objetivo, não erro);",
    "  - parágrafos reordenados ou frases reescritas.",
    "",
    "SIM, aponte (exemplo real do que você DEVE pegar):",
    '  - "Papa Francisco" quando o original diz "Pope Leo XIV"',
    "    → trocou a identidade. DIVERGENTE.",
    "",
    "Antes de listar uma divergência, faça a pergunta: *se eu traduzisse o",
    "trecho em português de volta para o inglês, ele contradiria o original?*",
    "Se a resposta for não, NÃO liste.",
    "",
    "FORMATO DA RESPOSTA",
    "",
    "Responda APENAS com um objeto JSON válido, sem texto antes ou depois:",
    "",
    // Mesmo motivo da adaptação: pedir JSON aqui falhava. Medido — de 5
    // reprovações factuais, 4 eram "checagem não foi produzida", ou seja o
    // modelo não devolveu JSON parseável. Formato de linhas resolve.
    "Responda EXATAMENTE assim, sem texto antes ou depois e sem cercas:",
    "",
    "VEREDITO: CONSISTENTE",
    "  (ou VEREDITO: DIVERGENTE, se encontrou algo dos tipos (a) a (e))",
    "",
    "Se — e somente se — o veredito for DIVERGENTE, liste abaixo uma",
    "divergência por linha, cada uma começando com hífen, citando o trecho em",
    "português e o que o original dizia:",
    "",
    "DIVERGENCIAS:",
    "- <trecho em português> — o original dizia <...>",
  ].join("\n");
}

export function montarUsuarioVerificacao(pedido: PedidoVerificacao): string {
  return [
    "=== ORIGINAL (inglês) ===",
    `Título: ${pedido.tituloOriginal}`,
    "",
    pedido.textoOriginal,
    "",
    "=== VERSÃO EM PORTUGUÊS (a ser auditada) ===",
    `Título: ${pedido.tituloAdaptado}`,
    "",
    pedido.corpoAdaptado,
  ].join("\n");
}

export function montarMensagensVerificacao(
  pedido: PedidoVerificacao,
): MensagemChat[] {
  return [
    { role: "system", content: montarSistemaVerificacao() },
    { role: "user", content: montarUsuarioVerificacao(pedido) },
  ];
}

export const ESQUEMA_JSON_VERIFICACAO: EsquemaJsonObjeto = {
  type: "object",
  properties: {
    consistente: {
      type: "boolean",
      description: "true apenas se nenhuma divergência foi encontrada.",
    },
    divergencias: { type: "array", items: { type: "string" } },
  },
  required: ["consistente", "divergencias"],
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// Parsing — tolerante na forma, rígido no conteúdo
// ---------------------------------------------------------------------------

/**
 * Extrai um objeto JSON de uma resposta que pode vir suja.
 *
 * Modelos pequenos ignoram "responda apenas com JSON" com frequência: embrulham
 * em ``` , escrevem "Aqui está:" antes, comentam depois. Aceitar essas formas é
 * pragmatismo, não relaxamento — o conteúdo continua sendo validado por zod
 * logo em seguida, e o guard-rail de recusa pega o texto que vazar para o
 * corpo.
 */
export function extrairJson(bruto: unknown): unknown {
  if (bruto === null || bruto === undefined) return null;

  // Alguns caminhos do JSON mode já devolvem objeto desserializado.
  if (typeof bruto === "object") return bruto;
  if (typeof bruto !== "string") return null;

  const texto = bruto.trim();
  if (texto.length === 0) return null;

  const tentativas: string[] = [texto];

  const semCerca = texto.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  if (semCerca !== texto) tentativas.push(semCerca.trim());

  const inicio = texto.indexOf("{");
  const fim = texto.lastIndexOf("}");
  if (inicio >= 0 && fim > inicio) tentativas.push(texto.slice(inicio, fim + 1));

  for (const t of tentativas) {
    try {
      const v: unknown = JSON.parse(t);
      if (v !== null && typeof v === "object") return v;
    } catch {
      // Próxima tentativa.
    }
  }
  return null;
}

const esquemaAdaptacao = z.object({
  titulo: z.string(),
  dek: z.string(),
  corpo_md: z.string(),
  // Categoria e tags não são críticas de segurança: se vierem tortas, o
  // fallback é seguro. Título, dek e corpo não têm fallback possível.
  categoria: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const esquemaVerificacao = z.object({
  // Rígido de propósito: campo faltando ou de tipo errado ⇒ sem veredito ⇒
  // `guardrails.ts` reprova. Nunca inferir "consistente" a partir de ausência.
  consistente: z.boolean(),
  divergencias: z.array(z.string()),
});

export function normalizarTag(bruta: string): string {
  return bruta
    .trim()
    .toLowerCase()
    .replace(/^[#"'`]+|[#"'`.,;]+$/g, "")
    .replace(/\s+/g, " ")
    .slice(0, LIMITES.MAX_CHARS_TAG);
}

/** Deduplica, normaliza e corta no teto. Não inventa tag quando faltam. */
export function normalizarTags(brutas: readonly string[]): string[] {
  const vistas = new Set<string>();
  const saida: string[] = [];
  for (const t of brutas) {
    const n = normalizarTag(t);
    if (n.length < 2 || vistas.has(n)) continue;
    vistas.add(n);
    saida.push(n);
    if (saida.length >= LIMITES.MAX_TAGS) break;
  }
  return saida;
}

/**
 * `null` significa "não deu para entender a resposta" — o chamador trata como
 * `resposta_invalida`, nunca como texto vazio aprovável.
 */
export function parsearAdaptacao(bruto: unknown): RespostaAdaptacao | null {
  // Formato de blocos primeiro — é o que o prompt pede.
  const porBlocos = parsearBlocos(bruto);
  if (porBlocos) return porBlocos;

  // JSON como reserva: se algum modelo/provider (o Anthropic, por exemplo)
  // devolver o objeto estruturado, continua funcionando sem mudar nada.
  const json = extrairJson(bruto);
  if (json === null) return null;

  const r = esquemaAdaptacao.safeParse(json);
  if (!r.success) return null;

  return {
    titulo: r.data.titulo.trim(),
    dek: r.data.dek.trim(),
    corpoMd: r.data.corpo_md.trim(),
    categoriaSugerida: (r.data.categoria ?? "").trim().toLowerCase(),
    tags: normalizarTags(r.data.tags ?? []),
  };
}

/**
 * Lê o formato de blocos (`TITULO:` / `DEK:` / `CATEGORIA:` / `TAGS:` / `CORPO:`).
 *
 * Existe porque pedir markdown longo dentro de string JSON falha de forma
 * sistemática nos modelos gratuitos do Workers AI — ver o comentário em
 * `montarSistemaAdaptacao`. Aqui o corpo pode conter aspas e quebras de linha
 * à vontade: o corte é por marcador, não por escape.
 *
 * Tolerante de propósito: aceita cerca de código em volta, acento no marcador
 * (`TÍTULO:`) e negrito de markdown (`**TITULO:**`), porque modelo livre
 * enfeita marcador com frequência e reprovar por causa de um asterisco seria
 * desperdiçar uma adaptação boa.
 */
function parsearBlocos(bruto: unknown): RespostaAdaptacao | null {
  if (typeof bruto !== "string") return null;

  const texto = bruto
    .replace(/^```(?:markdown|md|text)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  const marcador = (nome: string, alternativas: string[] = []) => {
    const todos = [nome, ...alternativas].join("|");
    return new RegExp(`^[*_\\s>#-]*(?:${todos})\\s*:\\s*`, "im");
  };

  const capturarLinha = (nome: string, alternativas: string[] = []) => {
    const re = marcador(nome, alternativas);
    const m = re.exec(texto);
    if (!m) return "";
    const resto = texto.slice(m.index + m[0].length);
    return (resto.split("\n", 1)[0] ?? "").replace(/\*+$/, "").trim();
  };

  const titulo = capturarLinha("TITULO", ["TÍTULO", "HEADLINE"]);
  const dek = capturarLinha("DEK", ["LINHA DE APOIO", "SUBTITULO", "SUBTÍTULO"]);
  const categoria = capturarLinha("CATEGORIA");
  const tagsBrutas = capturarLinha("TAGS");

  const mCorpo = marcador("CORPO", ["BODY", "CORPO_MD", "TEXTO"]).exec(texto);
  if (!mCorpo) return null;
  const corpoMd = texto.slice(mCorpo.index + mCorpo[0].length).trim();

  // Sem título ou sem corpo não há o que aproveitar — deixa a reserva de JSON
  // tentar, e se ela também falhar o guard-rail reprova.
  if (!titulo || !corpoMd) return null;

  return {
    titulo,
    dek,
    corpoMd,
    categoriaSugerida: categoria.toLowerCase(),
    tags: normalizarTags(
      tagsBrutas
        .split(/[,;]/)
        .map((t) => t.replace(/^[-*\s]+/, "").trim())
        .filter(Boolean),
    ),
  };
}

/** `null` ⇒ sem veredito ⇒ reprovação em `guardrails.ts`. */
/**
 * Divergências que são, na verdade, queixas de OMISSÃO.
 *
 * O prompt já manda explicitamente não apontar omissão — e o modelo ignora.
 * Medido contra o Llama 3.3 70B: das 5 "divergências" de um artigo, todas
 * eram do tipo *"a versão em português não menciona a data exata"*.
 *
 * Isso não é erro factual: o formato é adaptação de 40–50%, então descartar
 * detalhe é o objetivo declarado. Reprovar por omissão inviabilizaria o
 * pipeline inteiro.
 *
 * O filtro é deliberadamente estreito — pega só construções em que o texto em
 * português FALTA com algo. Queixa de contradição ("diz 5 bispos, o original
 * diz 12") tem forma afirmativa e passa direto, continuando a reprovar.
 */
const RE_OMISSAO =
  /\b(n[ãa]o\s+(menciona|inclui|informa|cita|especifica|detalha|traz|apresenta|indica|refere|reproduz|explicita|fornece|d[áa]|descreve|elenca|lista|quantifica|nomeia|identifica|aborda|contempla|reflete|abrange)|omit[ei]|omiss[ãa]o|deixa\s+de\s+\w+|falta\s+(a|o|mencionar|informar)|ausente\s+n[ao]\s+vers[ãa]o|apenas\s+menciona|se\s+limita\s+a)/i;

/**
 * Queixas que são apenas TRADUÇÃO ou FORMATAÇÃO, não erro factual.
 *
 * Medido: com o veredito funcionando, o checador passou a listar coisas como
 * *"nos dias 4 e 5 de agosto" — o original dizia "from Aug. 4–5" (formato de
 * data diferente)* e *"Papa Leão XIV alerta jovens" — o original dizia "Pope
 * Leo XIV: Use AI prudently"*. São a tradução fazendo o trabalho dela.
 *
 * Sem este filtro, achado real (o modelo escreveu "Papa Francisco" onde o
 * original dizia "Pope Leo XIV") se perde no meio de sete falsos positivos.
 */
const RE_RUIDO_DE_TRADUCAO =
  /\b(formato\s+(de\s+)?(data|n[úu]mero|hora)|formato\s+diferente|apenas\s+(uma\s+)?(tradu|reformul|adapta)|tradu(ção|zido|zida|z-se)|reescrit[ao]|reformula(do|da|ção)|equivalente\s+em\s+portugu[êe]s|mesma\s+(data|informa[çc][ãa]o|ideia)|corresponde\s+ao\s+original|vers[ãa]o\s+(mais\s+)?(curta|concisa|resumida))/i;

export function ehQueixaDeOmissao(divergencia: string): boolean {
  return RE_OMISSAO.test(divergencia);
}

export function ehRuidoDeTraducao(divergencia: string): boolean {
  return RE_RUIDO_DE_TRADUCAO.test(divergencia);
}

export function parsearVerificacao(bruto: unknown): VerificacaoFactual | null {
  // Formato de linhas primeiro — é o que o prompt pede.
  const porLinhas = parsearVeredito(bruto);
  if (porLinhas) return filtrarOmissoes(porLinhas);

  // JSON como reserva (provider Anthropic, ou modelo que resolva devolver).
  const json = extrairJson(bruto);
  if (json === null) return null;

  const r = esquemaVerificacao.safeParse(json);
  if (!r.success) return null;

  return filtrarOmissoes({
    consistente: r.data.consistente,
    divergencias: r.data.divergencias,
  });
}

/**
 * Lê `VEREDITO: CONSISTENTE|DIVERGENTE` + lista de `DIVERGENCIAS:`.
 *
 * Existe porque pedir JSON na verificação falhava: das 5 reprovações factuais
 * de um lote, 4 eram "checagem não foi produzida" — o modelo simplesmente não
 * devolvia JSON parseável. Sem veredito, o guard-rail reprova por precaução, o
 * que travava artigo bom.
 */
function parsearVeredito(bruto: unknown): VerificacaoFactual | null {
  if (typeof bruto !== "string") return null;

  const texto = bruto
    .replace(/^```(?:json|text|markdown)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  const mVeredito = /^[*_\s>#-]*VEREDITO\s*:\s*(\w+)/im.exec(texto);
  if (!mVeredito) return null;

  const consistente = /^consistente$/i.test(mVeredito[1] ?? "");

  const mLista = /^[*_\s>#-]*DIVERG[ÊE]NCIAS?\s*:/im.exec(texto);
  const divergencias = mLista
    ? texto
        .slice(mLista.index + mLista[0].length)
        .split("\n")
        .map((l) => l.replace(/^[\s*_>#-]+/, "").trim())
        .filter((l) => l.length > 12)
    : [];

  return { consistente, divergencias };
}

/**
 * Descarta queixas de OMISSÃO.
 *
 * O prompt já manda ignorá-las e o modelo ignora a instrução. Como o formato é
 * adaptação de 40–60%, descartar detalhe é o objetivo declarado — reprovar por
 * isso inviabilizaria o pipeline.
 */
function filtrarOmissoes(v: VerificacaoFactual): VerificacaoFactual {
  const relevantes = v.divergencias
    .map((d) => d.trim())
    .filter(
      (d) =>
        d.length > 0 &&
        !ehQueixaDeOmissao(d) &&
        !ehRuidoDeTraducao(d) &&
        // Filtro ESTRUTURAL: compara números, datas e nomes próprios dos dois
        // trechos citados. Pega o que `ehRuidoDeTraducao` não alcança, porque
        // aquele depende de o checador se explicar ("formato de data") e a
        // maioria das divergências só justapõe `"A" — o original dizia "B"`.
        // Medido: 34 de 55 tentativas do dia reprovadas, quase todas assim.
        !ehRuidoEstrutural(d),
    );

  return {
    // Se as únicas objeções eram omissões, o texto está consistente. Manter
    // `false` aqui reprovaria com lista de divergências vazia — o pior tipo de
    // reprovação, porque é inauditável.
    consistente: v.consistente || relevantes.length === 0,
    divergencias: relevantes,
  };
}

/** Slug sugerido pelo modelo só vale se existir de fato. */
export function categoriaValida(slug: string): boolean {
  return SLUGS_VALIDOS.includes(slug);
}
