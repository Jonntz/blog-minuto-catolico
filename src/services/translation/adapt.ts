/**
 * Orquestração da adaptação: fila de `draft` → matéria em PT-BR publicada, ou
 * `failed_validation` com o motivo registrado.
 *
 * ---------------------------------------------------------------------------
 * PONTO DE ENTRADA DA FASE 2
 * ---------------------------------------------------------------------------
 * Este módulo NÃO cria rota. A rota `/api/cron/*` pertence a outra frente; aqui
 * expõe-se apenas `adaptarPendentes(db, env, opcoes)`, que a integração chama.
 *
 * ---------------------------------------------------------------------------
 * POSTURA DE FALHA (a parte que não pode ser afrouxada)
 * ---------------------------------------------------------------------------
 * - Cota de Neurons estourada ou provider fora do ar ⇒ o item CONTINUA `draft`.
 *   Nada vai ao ar sem adaptação. O cron seguinte reprocessa a fila.
 * - Guard-rail reprovado ou resposta do modelo ilegível ⇒ `failed_validation`
 *   com `validationErrors` preenchido. Também não vai ao ar.
 * - `published` só acontece quando TODAS as regras passaram.
 *
 * Ou seja: existem exatamente dois caminhos que não publicam e um que publica,
 * e o que publica é o mais estreito dos três.
 */

import { desc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { articles, type Fonte, type StatusArtigo } from "@/db/schema";
import { CATEGORIA_PADRAO } from "@/lib/categories";
import { gerarSlug, slugDesambiguado } from "@/lib/slug";
import { assertarAnthropicConfigurado } from "./anthropic";
import {
  avaliarGuardRails,
  calcularAlvoCaracteres,
  montarCorpoFinal,
  preVoo,
  removerAtribuicaoDoModelo,
  type ContextoGuardRails,
} from "./guardrails";
import { categoriaValida } from "./prompt";
import {
  deveAbortarLote,
  ehErroTransitorio,
  ehNomeProvider,
  statusParaErro,
  type ErroProvider,
  type NomeProvider,
  type TranslationProvider,
} from "./provider";
import { criarProviderWorkersAi, type EnvComAi } from "./workers-ai";

// ---------------------------------------------------------------------------
// Parâmetros do lote
// ---------------------------------------------------------------------------

/**
 * Itens por execução.
 *
 * Baixo de propósito. São DUAS chamadas ao modelo por artigo (adaptação +
 * verificação), ambas carregando o glossário, contra uma cota de 10.000
 * Neurons/dia que ainda não foi medida na prática (MEMORY.md §3). Com cron a
 * cada 15 minutos são 96 execuções/dia — 5 itens por execução já é mais
 * vazão do que as duas fontes produzem. Melhor descobrir o consumo real com o
 * limite baixo do que acordar com a cota do dia queimada às 6h da manhã.
 */
export const LIMITE_PADRAO_LOTE = 5;

/** Teto absoluto, mesmo que alguém peça mais. Protege contra chamada errada. */
export const LIMITE_MAXIMO_LOTE = 25;

/**
 * Falhas seguidas do provider que abortam o lote. Se três artigos em sequência
 * quebraram, o problema não é o conteúdo — é o provider. Continuar só gasta
 * tempo de CPU do Worker.
 */
export const MAX_FALHAS_CONSECUTIVAS = 3;

// ---------------------------------------------------------------------------
// Env e opções
// ---------------------------------------------------------------------------

/**
 * `TRANSLATION_PROVIDER` é declarado no `wrangler.jsonc` e validado pelo zod em
 * `src/lib/env.ts` (Fase 2). Continua opcional aqui, com default seguro, para o
 * módulo seguir testável sem env completo.
 */
export interface EnvAdaptacao extends EnvComAi {
  TRANSLATION_PROVIDER?: string;
}

export interface OpcoesAdaptacao {
  /** Itens por execução. Default `LIMITE_PADRAO_LOTE`, teto `LIMITE_MAXIMO_LOTE`. */
  limite?: number;
  /** Injeta um provider pronto (testes, ou override da Fase 2). */
  provider?: TranslationProvider;
  /** Relógio injetável, em segundos unix. */
  agora?: () => number;
  /** Sink de log estruturado. Default: uma linha JSON por evento em stdout. */
  aoLogar?: (evento: EventoAdaptacao) => void;
}

// ---------------------------------------------------------------------------
// Log estruturado (CLAUDE.md §4 e §7)
// ---------------------------------------------------------------------------

export type EventoAdaptacao =
  | { tipo: "lote_iniciado"; provider: NomeProvider; modelo: string; limite: number }
  | { tipo: "item_pulado"; id: string; motivo: string }
  | { tipo: "item_publicado"; id: string; slug: string; tokensIn: number | null; tokensOut: number | null }
  | { tipo: "item_reprovado"; id: string; regras: string[]; erros: string[] }
  | { tipo: "item_adiado"; id: string; erro: ErroProvider }
  | { tipo: "lote_abortado"; motivo: string; restantes: number }
  | { tipo: "lote_concluido"; resumo: ResumoAdaptacao };

function logPadrao(evento: EventoAdaptacao): void {
  // Uma linha JSON por evento — é o formato que a observabilidade do Workers
  // (habilitada em wrangler.jsonc) consegue filtrar depois.
  console.log(JSON.stringify({ escopo: "translation.adapt", ...evento }));
}

// ---------------------------------------------------------------------------
// Resumo
// ---------------------------------------------------------------------------

export interface ResumoAdaptacao {
  provider: NomeProvider;
  modelo: string;
  /** Itens lidos da fila. */
  vistos: number;
  publicados: number;
  /** Foram para `failed_validation`. */
  reprovados: number;
  /** Continuam `draft` para a próxima execução. */
  adiados: number;
  tokensIn: number;
  tokensOut: number;
  duracaoMs: number;
  /** Preenchido quando o lote parou antes de esgotar a fila. */
  abortadoPor?: string;
}

/**
 * Converte o resumo nos campos de `ingestion_runs`.
 *
 * Este módulo NÃO escreve nessa tabela de propósito: a rota de cron pertence a
 * outra frente e é ela que abre e fecha a execução. Aqui só se entrega o
 * recorte pronto, para a Fase 2 gravar sem ter que reinterpretar nada.
 */
export function paraIngestionRun(resumo: ResumoAdaptacao): {
  itemsSeen: number;
  itemsPublished: number;
  itemsFailed: number;
  durationMs: number;
  error: string | null;
} {
  return {
    itemsSeen: resumo.vistos,
    itemsPublished: resumo.publicados,
    itemsFailed: resumo.reprovados,
    durationMs: resumo.duracaoMs,
    error: resumo.abortadoPor ?? null,
  };
}

// ---------------------------------------------------------------------------
// Seleção de provider
// ---------------------------------------------------------------------------

export function escolherProvider(env: EnvAdaptacao): TranslationProvider {
  const bruto = (env.TRANSLATION_PROVIDER ?? "workersAi").trim();

  if (!ehNomeProvider(bruto)) {
    throw new Error(
      `TRANSLATION_PROVIDER inválido: "${bruto}". Valores aceitos: workersAi, anthropic.`,
    );
  }
  if (bruto === "anthropic") {
    // Falha alta e cedo: pedir um provider não implementado é erro de
    // configuração, não condição de runtime a ser tolerada item a item.
    assertarAnthropicConfigurado();
  }
  return criarProviderWorkersAi(env);
}

// ---------------------------------------------------------------------------
// Leitura do texto original
// ---------------------------------------------------------------------------

/** Recorte da linha de `articles` que a adaptação consome. */
export interface LinhaPendente {
  id: string;
  slug: string;
  source: Fonte;
  sourceName: string;
  sourceUrl: string;
  sourceTitle: string;
  sourceExcerpt: string | null;
  sourceLength: number;
  categorySlug: string;
}

/**
 * ÚNICO ponto que sabe de onde vem o texto original.
 *
 * O schema não tem coluna para o corpo do artigo de origem — a maior porção que
 * a ingestão conseguiu obter legalmente vive em `source_excerpt`, e o tamanho
 * do original completo em `source_length`. Isso tem uma consequência dura, e é
 * melhor que ela esteja escrita aqui do que descoberta em produção: quando a
 * fonte só publica excerpt no feed (Sign of the Cross, 146–645 caracteres — ver
 * MEMORY.md §2.2), NÃO HÁ TEXTO SUFICIENTE para adaptar sem inventar, e o
 * pré-voo reprova o item antes de gastar uma chamada de modelo.
 *
 * Se um dia o corpo passar a ser guardado em outra coluna ou no R2, é esta
 * função que muda — e só ela.
 */
export function resolverTextoOriginal(linha: LinhaPendente): string {
  return (linha.sourceExcerpt ?? "").trim();
}

// ---------------------------------------------------------------------------
// Persistência
// ---------------------------------------------------------------------------

interface AtualizacaoArtigo {
  status: StatusArtigo;
  /** Reescrito no momento da publicação, a partir do título em PT-BR. */
  slug?: string;
  title?: string;
  dek?: string;
  bodyMd?: string;
  categorySlug?: string;
  tags?: string[];
  validationErrors: string[] | null;
  providerUsed: string;
  modelUsed: string;
  tokensIn: number | null;
  tokensOut: number | null;
  adaptedAt: number;
  updatedAt: number;
}

async function gravar(
  db: Db,
  id: string,
  dados: AtualizacaoArtigo,
): Promise<void> {
  await db.update(articles).set(dados).where(eq(articles.id, id));
}

/**
 * Escolhe o slug definitivo a partir do título em PT-BR.
 *
 * Devolve o slug ATUAL quando o novo colidiria de forma irrecuperável — nunca
 * deixa a publicação falhar por causa da URL.
 */
async function escolherSlugPtBr(
  db: Db,
  id: string,
  slugAtual: string,
  tituloPt: string,
): Promise<string> {
  const base = gerarSlug(tituloPt);
  if (!base || base === slugAtual) return slugAtual;

  for (const candidato of [base, slugDesambiguado(base, id.slice(0, 6))]) {
    const existente = await db
      .select({ id: articles.id })
      .from(articles)
      .where(eq(articles.slug, candidato))
      .limit(1);

    // Livre, ou já é deste mesmo artigo.
    if (existente.length === 0 || existente[0]?.id === id) return candidato;
  }

  return slugAtual;
}

/** Marca o item como reprovado sem ter gastado (ou aproveitado) o modelo. */
async function reprovar(
  db: Db,
  id: string,
  erros: string[],
  provider: TranslationProvider,
  agoraSeg: number,
): Promise<void> {
  await gravar(db, id, {
    status: "failed_validation",
    validationErrors: erros,
    providerUsed: provider.nome,
    modelUsed: provider.modelo,
    tokensIn: null,
    tokensOut: null,
    adaptedAt: agoraSeg,
    updatedAt: agoraSeg,
  });
}

// ---------------------------------------------------------------------------
// A função que a Fase 2 chama
// ---------------------------------------------------------------------------

/**
 * Processa um lote de artigos em `draft`.
 *
 * Não lança em falha de provider — devolve o resumo. A única exceção que
 * escapa daqui é configuração inválida (`TRANSLATION_PROVIDER` desconhecido ou
 * provider desativado), que deve mesmo derrubar a rota e aparecer no log.
 */
export async function adaptarPendentes(
  db: Db,
  env: EnvAdaptacao,
  opcoes: OpcoesAdaptacao = {},
): Promise<ResumoAdaptacao> {
  const inicio = Date.now();
  const agora = opcoes.agora ?? (() => Math.floor(Date.now() / 1000));
  const log = opcoes.aoLogar ?? logPadrao;

  const limite = Math.min(
    Math.max(1, Math.floor(opcoes.limite ?? LIMITE_PADRAO_LOTE)),
    LIMITE_MAXIMO_LOTE,
  );

  const provider = opcoes.provider ?? escolherProvider(env);

  const resumo: ResumoAdaptacao = {
    provider: provider.nome,
    modelo: provider.modelo,
    vistos: 0,
    publicados: 0,
    reprovados: 0,
    adiados: 0,
    tokensIn: 0,
    tokensOut: 0,
    duracaoMs: 0,
  };

  log({
    tipo: "lote_iniciado",
    provider: provider.nome,
    modelo: provider.modelo,
    limite,
  });

  const pendentes: LinhaPendente[] = await db
    .select({
      id: articles.id,
      slug: articles.slug,
      source: articles.source,
      sourceName: articles.sourceName,
      sourceUrl: articles.sourceUrl,
      sourceTitle: articles.sourceTitle,
      sourceExcerpt: articles.sourceExcerpt,
      sourceLength: articles.sourceLength,
      categorySlug: articles.categorySlug,
    })
    .from(articles)
    .where(eq(articles.status, "draft"))
    // Notícia velha vale menos que notícia nova: se a cota acabar no meio, que
    // tenha acabado depois de publicar o que é mais recente.
    .orderBy(desc(articles.publishedAt))
    .limit(limite);

  resumo.vistos = pendentes.length;

  let falhasSeguidas = 0;

  for (const [indice, linha] of pendentes.entries()) {
    const resultado = await processarItem(db, linha, provider, agora(), log);

    resumo.tokensIn += resultado.tokensIn ?? 0;
    resumo.tokensOut += resultado.tokensOut ?? 0;

    if (resultado.destino === "published") resumo.publicados += 1;
    else if (resultado.destino === "failed_validation") resumo.reprovados += 1;
    else resumo.adiados += 1;

    if (resultado.erroProvider) {
      falhasSeguidas += 1;
      const restantes = pendentes.length - indice - 1;

      if (deveAbortarLote(resultado.erroProvider)) {
        resumo.abortadoPor = `${resultado.erroProvider.tipo}: ${resultado.erroProvider.mensagem}`;
        resumo.adiados += restantes;
        log({ tipo: "lote_abortado", motivo: resumo.abortadoPor, restantes });
        break;
      }
      if (falhasSeguidas >= MAX_FALHAS_CONSECUTIVAS) {
        resumo.abortadoPor = `${MAX_FALHAS_CONSECUTIVAS} falhas consecutivas do provider; última: ${resultado.erroProvider.mensagem}`;
        resumo.adiados += restantes;
        log({ tipo: "lote_abortado", motivo: resumo.abortadoPor, restantes });
        break;
      }
    } else {
      falhasSeguidas = 0;
    }
  }

  resumo.duracaoMs = Date.now() - inicio;
  log({ tipo: "lote_concluido", resumo });
  return resumo;
}

// ---------------------------------------------------------------------------
// Um artigo
// ---------------------------------------------------------------------------

interface ResultadoItem {
  destino: StatusArtigo;
  tokensIn: number | null;
  tokensOut: number | null;
  /** Presente quando a falha veio do provider, não do conteúdo. */
  erroProvider?: ErroProvider;
}

async function processarItem(
  db: Db,
  linha: LinhaPendente,
  provider: TranslationProvider,
  agoraSeg: number,
  log: (e: EventoAdaptacao) => void,
): Promise<ResultadoItem> {
  const textoOriginal = resolverTextoOriginal(linha);

  // --- Pré-voo: não gastar Neurons em item impossível ----------------------
  const voo = preVoo(textoOriginal, linha.sourceLength);
  if (!voo.adaptavel) {
    const motivo = voo.motivo ?? "pre_voo: item não adaptável.";
    await reprovar(db, linha.id, [motivo], provider, agoraSeg);
    log({ tipo: "item_pulado", id: linha.id, motivo });
    return { destino: "failed_validation", tokensIn: null, tokensOut: null };
  }

  // --- Adaptação -----------------------------------------------------------
  const adaptacao = await provider.adaptar({
    tituloOriginal: linha.sourceTitle,
    textoOriginal,
    comprimentoOriginal: linha.sourceLength,
    sourceName: linha.sourceName,
    categoriaAtual: linha.categorySlug,
    alvoCaracteres: calcularAlvoCaracteres(textoOriginal.length),
  });

  if (!adaptacao.ok) {
    return await tratarErroProvider(db, linha, provider, adaptacao.erro, agoraSeg, log);
  }

  const corpoEditorial = removerAtribuicaoDoModelo(adaptacao.valor.corpoMd);
  let tokensIn = adaptacao.uso.tokensIn;
  let tokensOut = adaptacao.uso.tokensOut;

  // --- Verificação factual adversarial -------------------------------------
  const verificacao = await provider.verificarFatos({
    textoOriginal,
    tituloOriginal: linha.sourceTitle,
    tituloAdaptado: adaptacao.valor.titulo,
    corpoAdaptado: corpoEditorial,
  });

  if (verificacao.ok) {
    tokensIn = somar(tokensIn, verificacao.uso.tokensIn);
    tokensOut = somar(tokensOut, verificacao.uso.tokensOut);
  } else if (ehErroTransitorio(verificacao.erro)) {
    // Cota/rede: NÃO reprova o texto por causa da nossa infraestrutura. O item
    // volta para a fila e o próximo cron refaz — sim, pagando de novo a
    // adaptação. É o preço de não publicar sem checagem nem queimar conteúdo
    // bom por um erro que não é dele.
    return await tratarErroProvider(db, linha, provider, verificacao.erro, agoraSeg, log, {
      tokensIn,
      tokensOut,
    });
  }
  /**
   * Resposta ilegível do checador ⇒ ADIAR, não reprovar.
   *
   * Medido nos modelos gratuitos do Workers AI: eles cumprem o formato de
   * saída pedido apenas parte das vezes, de forma inconsistente. Tratar
   * "sem veredito" como reprovação definitiva QUEIMAVA o artigo por uma falha
   * de formatação do checador — chegou a zerar um lote de 8.
   *
   * Adiar mantém a postura fail-closed (o artigo continua `draft`, NUNCA vai
   * ao ar sem checagem) e é recuperável: o próximo cron tenta de novo.
   *
   * O que NÃO se perde: os guard-rails determinísticos (números inventados,
   * idioma, proporção, atribuição, rito de 1962, glossário) não dependem do
   * modelo e continuariam valendo. O que se adia é só a camada semântica.
   */
  if (!verificacao.ok) {
    const erro: ErroProvider = {
      tipo: "resposta_invalida",
      mensagem:
        "checador não produziu veredito legível — adiado para nova tentativa",
    };
    log({ tipo: "item_adiado", id: linha.id, erro });
    return { destino: "draft", tokensIn, tokensOut, erroProvider: erro };
  }

  // --- Guard-rails ---------------------------------------------------------
  const ctx: ContextoGuardRails = {
    fonte: linha.source,
    sourceName: linha.sourceName,
    sourceUrl: linha.sourceUrl,
    comprimentoOriginal: linha.sourceLength,
    textoOriginal,
    corpoMd: corpoEditorial,
    titulo: adaptacao.valor.titulo,
    dek: adaptacao.valor.dek,
    tags: adaptacao.valor.tags,
    verificacao: verificacao.ok ? verificacao.valor : null,
  };

  const veredito = avaliarGuardRails(ctx);

  if (!veredito.aprovado) {
    await gravar(db, linha.id, {
      status: "failed_validation",
      // O texto reprovado é gravado de propósito: sem ele, diagnosticar por que
      // um artigo não subiu exigiria reprocessar e torcer para o erro se
      // repetir. Ele nunca aparece no site — as consultas do portal filtram por
      // `status = 'published'`.
      title: adaptacao.valor.titulo,
      dek: adaptacao.valor.dek,
      bodyMd: corpoEditorial,
      validationErrors: veredito.erros,
      providerUsed: provider.nome,
      modelUsed: provider.modelo,
      tokensIn,
      tokensOut,
      adaptedAt: agoraSeg,
      updatedAt: agoraSeg,
    });
    log({
      tipo: "item_reprovado",
      id: linha.id,
      regras: veredito.regrasReprovadas,
      erros: veredito.erros,
    });
    return { destino: "failed_validation", tokensIn, tokensOut };
  }

  // --- Publicação ----------------------------------------------------------
  /**
   * Slug refeito a partir do título em PORTUGUÊS.
   *
   * O slug original vem da ingestão, derivada do título em inglês — a URL
   * sairia `/noticia/florida-bishops-urge-catholics-to-end-death-penalty` num
   * portal em português. Só dá para corrigir aqui, porque só agora existe
   * título em PT-BR.
   *
   * A coluna tem índice UNIQUE, então colisão é tratada com sufixo derivado do
   * id (determinístico: reprocessar o mesmo artigo dá o mesmo slug). Se nem
   * assim der, mantém-se o slug antigo — URL feia é melhor que falha de
   * gravação com o artigo pronto.
   */
  const slugFinal = await escolherSlugPtBr(
    db,
    linha.id,
    linha.slug,
    adaptacao.valor.titulo,
  );

  await gravar(db, linha.id, {
    status: "published",
    slug: slugFinal,
    title: adaptacao.valor.titulo,
    dek: adaptacao.valor.dek,
    // A atribuição é acrescentada AQUI, por nós, a partir das colunas de
    // proveniência — nunca escrita pelo modelo, que poderia alucinar a URL.
    bodyMd: montarCorpoFinal(corpoEditorial, linha.sourceName, linha.sourceUrl),
    categorySlug: refinarCategoria(linha.categorySlug, adaptacao.valor.categoriaSugerida),
    tags: adaptacao.valor.tags,
    validationErrors: null,
    providerUsed: provider.nome,
    modelUsed: provider.modelo,
    tokensIn,
    tokensOut,
    adaptedAt: agoraSeg,
    updatedAt: agoraSeg,
  });

  log({
    tipo: "item_publicado",
    id: linha.id,
    slug: linha.slug,
    tokensIn,
    tokensOut,
  });
  return { destino: "published", tokensIn, tokensOut };
}

// ---------------------------------------------------------------------------
// Auxiliares
// ---------------------------------------------------------------------------

function somar(a: number | null, b: number | null): number | null {
  if (a === null && b === null) return null;
  return (a ?? 0) + (b ?? 0);
}

/**
 * A sugestão do modelo só substitui a da ingestão quando esta caiu no fallback.
 *
 * As duas fontes publicam categorias grosseiras (o EWTN só emite 'World' e
 * 'Vatican'), então quase tudo chega como `vaticano` por falta de sinal — e aí
 * quem leu o artigo inteiro tem mais informação que o mapa de categorias do
 * feed. Já quando a ingestão encontrou um mapeamento explícito, ele vale mais:
 * veio de dado da fonte, não de palpite de modelo.
 */
export function refinarCategoria(atual: string, sugerida: string): string {
  if (atual !== CATEGORIA_PADRAO) return atual;
  if (!categoriaValida(sugerida)) return atual;
  return sugerida;
}

async function tratarErroProvider(
  db: Db,
  linha: LinhaPendente,
  provider: TranslationProvider,
  erro: ErroProvider,
  agoraSeg: number,
  log: (e: EventoAdaptacao) => void,
  uso: { tokensIn: number | null; tokensOut: number | null } = {
    tokensIn: null,
    tokensOut: null,
  },
): Promise<ResultadoItem> {
  const destino = statusParaErro(erro);

  if (destino === "draft") {
    // Nada é gravado: o item já está `draft` e precisa continuar exatamente
    // como estava para o próximo cron pegá-lo. Escrever `adaptedAt` aqui
    // mentiria dizendo que houve adaptação.
    log({ tipo: "item_adiado", id: linha.id, erro });
    return { destino: "draft", tokensIn: uso.tokensIn, tokensOut: uso.tokensOut, erroProvider: erro };
  }

  await gravar(db, linha.id, {
    status: "failed_validation",
    validationErrors: [`${erro.tipo}: ${erro.mensagem}`],
    providerUsed: provider.nome,
    modelUsed: provider.modelo,
    tokensIn: uso.tokensIn,
    tokensOut: uso.tokensOut,
    adaptedAt: agoraSeg,
    updatedAt: agoraSeg,
  });
  log({
    tipo: "item_reprovado",
    id: linha.id,
    regras: ["provider"],
    erros: [`${erro.tipo}: ${erro.mensagem}`],
  });
  return {
    destino: "failed_validation",
    tokensIn: uso.tokensIn,
    tokensOut: uso.tokensOut,
    erroProvider: erro,
  };
}
