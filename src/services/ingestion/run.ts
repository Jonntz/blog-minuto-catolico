/**
 * Orquestração de uma execução de ingestão.
 *
 * CLAUDE.md §4/§7: "falha silenciosa de ingestão é o pior cenário para um portal
 * de notícias". Por isso a linha em `ingestion_runs` é escrita em DOIS tempos —
 * INSERT no início, UPDATE no fim. Se o Worker morrer no meio (timeout, OOM,
 * deploy), sobra uma linha com `finished_at` nulo: evidência visível de execução
 * interrompida. Um único INSERT no fim não deixaria rastro nenhum.
 */

import { eq } from "drizzle-orm";
import { getDb, type Db } from "@/db";
import { ingestionRuns } from "@/db/schema";
import type { Fonte } from "@/db/schema";
import { getUserAgent, getValidatedEnv } from "@/lib/env";
import { gravarItens } from "./dedupe";
import { coletarEwtn } from "./sources/ewtn";
import { coletarSotc, enriquecerSotc } from "./sources/sotc";
import type { ColetaDaFonte, ContextoIngestao } from "./types";

export interface ResultadoDaFonte {
  fonte: Fonte;
  runId: string;
  itemsSeen: number;
  itemsNew: number;
  itemsDuplicate: number;
  itemsFailed: number;
  /** Duplicados cujo conteúdo mudou na origem e foram refrescados. */
  itemsUpdated: number;
  durationMs: number;
  erro?: string;
}

export interface ResultadoIngestao {
  ok: boolean;
  durationMs: number;
  fontes: ResultadoDaFonte[];
}

interface DefinicaoDeFonte {
  fonte: Fonte;
  coletar: (ctx: ContextoIngestao) => Promise<ColetaDaFonte>;
  /** Segunda fase opcional (só o SOTC precisa: imagem via og:image). */
  enriquecer?: (db: Db, ctx: ContextoIngestao) => Promise<unknown>;
}

const DEFINICOES: readonly DefinicaoDeFonte[] = [
  { fonte: "ewtn", coletar: coletarEwtn },
  { fonte: "sotc", coletar: coletarSotc, enriquecer: enriquecerSotc },
];

function mensagemDeErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro);
}

async function abrirExecucao(db: Db, fonte: Fonte, agora: number): Promise<string> {
  const runId = crypto.randomUUID();
  await db.insert(ingestionRuns).values({ id: runId, source: fonte, startedAt: agora });
  return runId;
}

async function fecharExecucao(
  db: Db,
  runId: string,
  resultado: ResultadoDaFonte,
): Promise<void> {
  await db
    .update(ingestionRuns)
    .set({
      finishedAt: Math.floor(Date.now() / 1000),
      durationMs: resultado.durationMs,
      itemsSeen: resultado.itemsSeen,
      itemsNew: resultado.itemsNew,
      itemsDuplicate: resultado.itemsDuplicate,
      itemsFailed: resultado.itemsFailed,
      // A ingestão nunca publica — a promoção é da fase de adaptação.
      itemsPublished: 0,
      error: resultado.erro,
    })
    .where(eq(ingestionRuns.id, runId));
}

async function executarFonte(
  db: Db,
  definicao: DefinicaoDeFonte,
  ctx: ContextoIngestao,
): Promise<ResultadoDaFonte> {
  const inicio = Date.now();
  const runId = await abrirExecucao(db, definicao.fonte, ctx.agora);

  const resultado: ResultadoDaFonte = {
    fonte: definicao.fonte,
    runId,
    itemsSeen: 0,
    itemsNew: 0,
    itemsDuplicate: 0,
    itemsFailed: 0,
    itemsUpdated: 0,
    durationMs: 0,
  };

  try {
    const coleta = await definicao.coletar(ctx);
    resultado.itemsSeen = coleta.itens.length + coleta.descartados;
    resultado.itemsFailed = coleta.descartados;

    const resumo = await gravarItens(db, coleta.itens, ctx.agora);
    resultado.itemsNew = resumo.novos;
    resultado.itemsDuplicate = resumo.duplicados;
    resultado.itemsUpdated = resumo.atualizados;
    resultado.itemsFailed += resumo.falhas;

    if (definicao.enriquecer) {
      // Falha de enriquecimento não invalida a coleta: o item já está no banco
      // e volta para a fila na próxima execução.
      const enriquecimento = await definicao.enriquecer(db, ctx);
      console.log(
        JSON.stringify({
          evento: "enriquecimento_concluido",
          fonte: definicao.fonte,
          ...(typeof enriquecimento === "object" && enriquecimento !== null
            ? enriquecimento
            : {}),
        }),
      );
    }
  } catch (erro) {
    resultado.erro = mensagemDeErro(erro);
    console.error(
      JSON.stringify({
        evento: "ingestao_fonte_falhou",
        fonte: definicao.fonte,
        runId,
        erro: resultado.erro,
      }),
    );
  }

  resultado.durationMs = Date.now() - inicio;
  await fecharExecucao(db, runId, resultado);

  console.log(
    JSON.stringify({
      evento: "ingestao_fonte_concluida",
      ...resultado,
    }),
  );

  return resultado;
}

/**
 * Executa a ingestão de todas as fontes habilitadas.
 *
 * Sequencial: as fontes estão em hosts diferentes, mas serializar mantém o pico
 * de uso do Worker baixo e torna o log legível na ordem em que aconteceu — que é
 * o que importa quando algo quebra às 3 da manhã.
 */
export async function executarIngestao(): Promise<ResultadoIngestao> {
  const inicio = Date.now();
  const db = await getDb();
  const env = await getValidatedEnv();
  const userAgent = await getUserAgent();

  const ctx: ContextoIngestao = { userAgent, agora: Math.floor(inicio / 1000) };

  const habilitadas = DEFINICOES.filter(
    (d) => d.fonte !== "sotc" || env.SOURCE_SOTC_ENABLED,
  );

  const fontes: ResultadoDaFonte[] = [];
  for (const definicao of habilitadas) {
    fontes.push(await executarFonte(db, definicao, ctx));
  }

  const resultado: ResultadoIngestao = {
    // "ok" = ao menos uma fonte concluiu sem erro fatal. Todas falharem é
    // incidente; uma falhar é degradação e o health-check enxerga na tabela.
    ok: fontes.length > 0 && fontes.some((f) => !f.erro),
    durationMs: Date.now() - inicio,
    fontes,
  };

  console.log(JSON.stringify({ evento: "ingestao_concluida", ...resultado }));
  return resultado;
}
