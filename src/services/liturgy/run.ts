import { and, eq, gte, lte, sql } from "drizzle-orm";
import { getDb, schema, type Db } from "@/db";
import type { NovoLiturgicalDay } from "@/db/schema";
import { baixarCalendario, urlDoCalendario } from "./fetch";
import {
  LiturgyParseError,
  parseCalendarioLiturgico,
  type DiaLiturgico,
} from "./parser";

/**
 * Execução da ingestão do calendário litúrgico de 1962.
 *
 * Orquestra buscar → parsear → gravar → registrar. As três primeiras etapas
 * vivem em módulos separados justamente para que esta possa ser lida de cima a
 * baixo sem entrar em detalhe de HTML nem de SQL.
 *
 * Cadência: MENSAL. A página do ano corrente é publicada mês a mês, então
 * raspar uma vez por ano deixaria o calendário parado em janeiro. Ver
 * `urlDoCalendario`.
 */

/** Fuso do portal. A liturgia do dia é a de São Paulo, não a de UTC. */
const FUSO = "America/Sao_Paulo";

/**
 * Linhas por INSERT. O D1 aceita no máximo 100 parâmetros vinculados por
 * consulta e `liturgical_days` tem 15 colunas — 6 × 15 = 90 cabe com folga.
 * Passar disso não degrada: quebra em runtime.
 */
const LINHAS_POR_LOTE = 6;

export interface OpcoesExecucao {
  /**
   * Ano a recarregar. Ausente = página do ano corrente (`/calendario/`), que é
   * o caso do cron. Informar um ano serve para backfill de anos anteriores.
   */
  ano?: number;
  /** Injetável em teste; por padrão, agora. */
  agora?: Date;
}

export interface ResultadoExecucao {
  runId: string;
  ok: boolean;
  url: string;
  ano: number;
  /** Dias reconhecidos na página. */
  diasVistos: number;
  /** Dias que ainda não existiam no banco. */
  diasNovos: number;
  /** Dias que já existiam e foram atualizados. */
  diasAtualizados: number;
  /** Linhas que pareciam dias mas foram descartadas. */
  linhasRejeitadas: number;
  mesesPresentes: number[];
  avisos: string[];
  duracaoMs: number;
  erro?: string;
}

// ---------------------------------------------------------------------------

/**
 * Roda a ingestão de ponta a ponta.
 *
 * Nunca lança: qualquer falha vira `ok: false` com o erro registrado em
 * `ingestion_runs`. Uma exceção escapando daqui viraria um 500 opaco no cron e
 * sumiria — que é exatamente o modo de falha que o CLAUDE.md §4 chama de pior
 * cenário possível.
 */
export async function executarIngestaoLiturgia(
  opcoes: OpcoesExecucao = {},
): Promise<ResultadoExecucao> {
  const inicio = Date.now();
  const runId = crypto.randomUUID();
  const agora = opcoes.agora ?? new Date();
  const url = urlDoCalendario(opcoes.ano);
  const db = await getDb();

  await abrirRun(db, runId, inicio);

  try {
    const html = await baixarCalendario(url);

    const analise = parseCalendarioLiturgico(html, {
      url,
      anoEsperado: opcoes.ano ?? anoCorrente(agora),
    });

    const gravacao = await gravarDias(db, analise.dias, url, inicio);

    const resultado: ResultadoExecucao = {
      runId,
      ok: true,
      url,
      ano: analise.ano,
      diasVistos: analise.dias.length,
      diasNovos: gravacao.novos,
      diasAtualizados: gravacao.atualizados,
      linhasRejeitadas: analise.rejeitadas.length,
      mesesPresentes: analise.mesesPresentes,
      avisos: analise.avisos,
      duracaoMs: Date.now() - inicio,
    };

    await fecharRun(db, runId, resultado);
    registrar("liturgia_ok", resultado);
    return resultado;
  } catch (erro) {
    const mensagem = descreverErro(erro);
    const resultado: ResultadoExecucao = {
      runId,
      ok: false,
      url,
      ano: opcoes.ano ?? anoCorrente(agora),
      diasVistos: 0,
      diasNovos: 0,
      diasAtualizados: 0,
      linhasRejeitadas: 0,
      mesesPresentes: [],
      avisos: [],
      duracaoMs: Date.now() - inicio,
      erro: mensagem,
    };

    await fecharRun(db, runId, resultado).catch(() => {
      // Se nem o registro da falha grava, o banco está fora — o log fica.
    });
    registrar("liturgia_falhou", resultado);
    return resultado;
  }
}

// ---------------------------------------------------------------------------
// Gravação
// ---------------------------------------------------------------------------

interface Gravacao {
  novos: number;
  atualizados: number;
}

/**
 * Upsert por data.
 *
 * Duas garantias exigidas pelo enunciado, ambas resolvidas no SQL e não em
 * código de aplicação (onde uma execução concorrente furaria a checagem):
 *
 *  1. **Não duplica** — `date` é a PK e o conflito vira UPDATE.
 *  2. **Não apaga dado bom** — os campos opcionais usam
 *     `coalesce(excluded.x, liturgical_days.x)`. Se uma recarga vier degradada
 *     (a fonte reordenou uma célula e a cor saiu `null`), o valor bom que já
 *     estava lá permanece. `feast` e `weekday` são sobrescritos direto: o
 *     parser garante que nunca chegam vazios até aqui.
 */
async function gravarDias(
  db: Db,
  dias: readonly DiaLiturgico[],
  url: string,
  agoraMs: number,
): Promise<Gravacao> {
  if (dias.length === 0) return { novos: 0, atualizados: 0 };

  const fetchedAt = Math.floor(agoraMs / 1000);
  const existentes = await datasJaGravadas(db, dias);

  const linhas: NovoLiturgicalDay[] = dias.map((dia) => ({
    ...dia,
    sourceUrl: url,
    fetchedAt,
  }));

  for (let i = 0; i < linhas.length; i += LINHAS_POR_LOTE) {
    const lote = linhas.slice(i, i + LINHAS_POR_LOTE);
    await db
      .insert(schema.liturgicalDays)
      .values(lote)
      .onConflictDoUpdate({
        target: schema.liturgicalDays.date,
        set: {
          weekday: sql`excluded.weekday`,
          feast: sql`excluded.feast`,
          commemoration: sql`coalesce(excluded.commemoration, liturgical_days.commemoration)`,
          classis: sql`coalesce(excluded.classis, liturgical_days.classis)`,
          marianSaint: sql`coalesce(excluded.marian_saint, liturgical_days.marian_saint)`,
          color: sql`coalesce(excluded.color, liturgical_days.color)`,
          gloria: sql`coalesce(excluded.gloria, liturgical_days.gloria)`,
          credo: sql`coalesce(excluded.credo, liturgical_days.credo)`,
          preface: sql`coalesce(excluded.preface, liturgical_days.preface)`,
          note: sql`coalesce(excluded.note, liturgical_days.note)`,
          epistle: sql`coalesce(excluded.epistle, liturgical_days.epistle)`,
          gospel: sql`coalesce(excluded.gospel, liturgical_days.gospel)`,
          sourceUrl: sql`excluded.source_url`,
          fetchedAt: sql`excluded.fetched_at`,
        },
      });
  }

  const novos = dias.filter((d) => !existentes.has(d.date)).length;
  return { novos, atualizados: dias.length - novos };
}

/**
 * Quais das datas já estavam no banco.
 *
 * Consultado por FAIXA (primeira e última data do lote) em vez de por `IN
 * (...)`: uma lista de 365 datas estouraria o teto de parâmetros do D1, e a
 * faixa cobre o mesmo conjunto com dois parâmetros.
 */
async function datasJaGravadas(
  db: Db,
  dias: readonly DiaLiturgico[],
): Promise<Set<string>> {
  const datas = dias.map((d) => d.date).sort();
  const primeira = datas[0];
  const ultima = datas[datas.length - 1];
  if (!primeira || !ultima) return new Set();

  const linhas = await db
    .select({ date: schema.liturgicalDays.date })
    .from(schema.liturgicalDays)
    .where(
      and(
        gte(schema.liturgicalDays.date, primeira),
        lte(schema.liturgicalDays.date, ultima),
      ),
    );

  return new Set(linhas.map((l) => l.date));
}

// ---------------------------------------------------------------------------
// Observabilidade (CLAUDE.md §7)
// ---------------------------------------------------------------------------

async function abrirRun(db: Db, runId: string, inicioMs: number): Promise<void> {
  await db.insert(schema.ingestionRuns).values({
    id: runId,
    source: "liturgy",
    startedAt: Math.floor(inicioMs / 1000),
  });
}

/**
 * Fecha a linha de `ingestion_runs`.
 *
 * O mapeamento dos contadores genéricos para o domínio da liturgia:
 *   itemsSeen      → dias reconhecidos na página
 *   itemsNew       → datas que ainda não existiam
 *   itemsDuplicate → datas que já existiam (atualizadas)
 *   itemsPublished → total efetivamente gravado
 *   itemsFailed    → linhas rejeitadas pelo parser
 */
async function fecharRun(
  db: Db,
  runId: string,
  resultado: ResultadoExecucao,
): Promise<void> {
  const fim = Math.floor(Date.now() / 1000);
  await db
    .update(schema.ingestionRuns)
    .set({
      finishedAt: fim,
      durationMs: resultado.duracaoMs,
      itemsSeen: resultado.diasVistos,
      itemsNew: resultado.diasNovos,
      itemsDuplicate: resultado.diasAtualizados,
      itemsPublished: resultado.diasNovos + resultado.diasAtualizados,
      itemsFailed: resultado.linhasRejeitadas,
      error: resultado.erro ?? null,
    })
    .where(eq(schema.ingestionRuns.id, runId));
}

/** Log estruturado — é o que o health-check e o `wrangler tail` leem. */
function registrar(evento: string, resultado: ResultadoExecucao): void {
  const linha = JSON.stringify({ evento, ...resultado });
  if (resultado.ok) console.log(linha);
  else console.error(linha);
}

function descreverErro(erro: unknown): string {
  if (erro instanceof LiturgyParseError) {
    return `${erro.message} | detalhes=${JSON.stringify(erro.detalhes)}`;
  }
  if (erro instanceof Error) return `${erro.name}: ${erro.message}`;
  return String(erro);
}

/** Ano corrente no fuso do portal — não no fuso do datacenter. */
function anoCorrente(agora: Date): number {
  return Number(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: FUSO,
      year: "numeric",
    }).format(agora),
  );
}
