import { desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { articles, ingestionRuns, liturgicalDays } from "@/db/schema";

/**
 * Health-check (CLAUDE.md §7).
 *
 * O `CLAUDE.md` §4 diz que "falha silenciosa de ingestão é o pior cenário para
 * um portal de notícias". Esta rota existe para que essa falha não seja
 * silenciosa: um monitor externo (UptimeRobot, cron-job.org, o que for) bate
 * aqui e recebe 503 quando algo parou.
 *
 * NÃO é protegida por `CRON_SECRET` de propósito — um health-check que exige
 * segredo não serve para monitoramento externo. Por isso ela expõe contagens e
 * carimbos de tempo, nunca conteúdo, URL de fonte ou mensagem de erro crua.
 */

/** Sem execução de ingestão neste prazo, algo está errado (cron é de 15 min). */
const LIMITE_SEM_INGESTAO_S = 90 * 60;

/**
 * Folga mínima do calendário litúrgico, em dias.
 *
 * Este limite existe por causa de 01/08/2026: o painel de liturgia da capa
 * sumiu porque o calendário do Salve Maria terminava em 31/07 e a fonte ainda
 * não havia publicado agosto. O health-check da época só sabia responder "tem
 * liturgia hoje?" — ou seja, só acusava o problema DEPOIS de o site já estar
 * sem o painel, quando não havia mais nada a fazer além de esperar.
 *
 * Medir a folga faz o aviso chegar com uma semana de antecedência, enquanto
 * ainda dá para agir (cobrar a fonte, importar o mês à mão, buscar outra).
 */
const FOLGA_MINIMA_LITURGIA_DIAS = 7;

type Estado = "ok" | "degradado" | "parado";

export async function GET(): Promise<NextResponse> {
  const agora = Math.floor(Date.now() / 1000);

  try {
    const db = await getDb();

    const [porStatus, ultimaIngestao, ultimasFalhas, liturgiaHoje] =
      await Promise.all([
        db
          .select({ status: articles.status, n: sql<number>`count(*)` })
          .from(articles)
          .groupBy(articles.status),

        db
          .select({
            source: ingestionRuns.source,
            finishedAt: ingestionRuns.finishedAt,
            error: ingestionRuns.error,
          })
          .from(ingestionRuns)
          .orderBy(desc(ingestionRuns.startedAt))
          .limit(1),

        // Execuções seguidas com erro indicam problema persistente, não soluço.
        db
          .select({ n: sql<number>`count(*)` })
          .from(ingestionRuns)
          .where(
            sql`${ingestionRuns.error} is not null and ${ingestionRuns.startedAt} >= ${agora - 6 * 3600}`,
          ),

        /**
         * Uma consulta só responde às duas perguntas: "tem hoje?" e "até
         * quando vai?". `date('now')` do SQLite é UTC; a diferença para
         * `America/Sao_Paulo` é de no máximo um dia na virada, e para uma
         * métrica de folga medida em dias isso não muda decisão nenhuma.
         */
        db
          .select({
            hoje: sql<number>`sum(case when ${liturgicalDays.date} = date('now') then 1 else 0 end)`,
            ultimo: sql<string | null>`max(${liturgicalDays.date})`,
            folga: sql<
              number | null
            >`cast(julianday(max(${liturgicalDays.date})) - julianday(date('now')) as integer)`,
          })
          .from(liturgicalDays),
      ]);

    const contagens = Object.fromEntries(
      porStatus.map((l) => [l.status, Number(l.n)]),
    ) as Record<string, number>;

    const publicados = contagens.published ?? 0;
    const naFila = contagens.draft ?? 0;
    const reprovados = contagens.failed_validation ?? 0;

    const fimUltima = ultimaIngestao[0]?.finishedAt ?? null;
    const segundosSemIngestao = fimUltima === null ? null : agora - fimUltima;
    const falhasRecentes = Number(ultimasFalhas[0]?.n ?? 0);

    const temLiturgiaHoje = Number(liturgiaHoje[0]?.hoje ?? 0) > 0;
    const ultimoDiaLiturgia = liturgiaHoje[0]?.ultimo ?? null;
    // Tabela vazia trata como folga zero — pior caso, nunca "sem problema".
    const folgaLiturgiaDias = Number(liturgiaHoje[0]?.folga ?? 0);

    const problemas: string[] = [];

    if (segundosSemIngestao === null) {
      problemas.push("nenhuma execução de ingestão registrada");
    } else if (segundosSemIngestao > LIMITE_SEM_INGESTAO_S) {
      problemas.push(
        `sem ingestão há ${Math.floor(segundosSemIngestao / 60)} min (limite ${LIMITE_SEM_INGESTAO_S / 60})`,
      );
    }

    if (publicados === 0) {
      problemas.push("nenhum artigo publicado — o site está vazio");
    }

    if (!temLiturgiaHoje) {
      problemas.push(
        `sem liturgia gravada para hoje — o calendário termina em ${ultimoDiaLiturgia ?? "(tabela vazia)"}`,
      );
    } else if (folgaLiturgiaDias < FOLGA_MINIMA_LITURGIA_DIAS) {
      // O aviso que faltava em agosto/2026: a capa ainda está inteira, mas vai
      // deixar de estar. Chega enquanto ainda dá para agir.
      problemas.push(
        `liturgia acaba em ${folgaLiturgiaDias} dia(s) (${ultimoDiaLiturgia}) — a fonte ainda não publicou o mês seguinte`,
      );
    }

    if (falhasRecentes >= 3) {
      problemas.push(`${falhasRecentes} execuções com erro nas últimas 6h`);
    }

    /**
     * `parado` só quando o site está de fato inútil (sem conteúdo ou sem
     * ingestão). Fila crescida ou liturgia atrasada é `degradado`: o portal
     * continua servindo, mas alguém precisa olhar.
     */
    const estado: Estado =
      publicados === 0 ||
      segundosSemIngestao === null ||
      segundosSemIngestao > LIMITE_SEM_INGESTAO_S
        ? "parado"
        : problemas.length > 0
          ? "degradado"
          : "ok";

    return NextResponse.json(
      {
        estado,
        agora,
        artigos: { publicados, naFila, reprovados },
        ingestao: {
          ultimaFonte: ultimaIngestao[0]?.source ?? null,
          segundosDesdeUltima: segundosSemIngestao,
          falhasUltimas6h: falhasRecentes,
        },
        liturgia: {
          temHoje: temLiturgiaHoje,
          ultimoDia: ultimoDiaLiturgia,
          folgaDias: folgaLiturgiaDias,
        },
        problemas,
      },
      {
        // 503 é o que faz um monitor externo disparar alerta. Devolver 200 com
        // `estado: "parado"` no corpo seria falha silenciosa com outro nome.
        status: estado === "parado" ? 503 : 200,
        headers: { "cache-control": "no-store" },
      },
    );
  } catch (erro) {
    console.error(
      JSON.stringify({
        evento: "health_check_falhou",
        erro: erro instanceof Error ? erro.message : String(erro),
      }),
    );
    // Sem detalhe do erro na resposta: esta rota é pública.
    return NextResponse.json(
      { estado: "parado", problemas: ["banco de dados inacessível"] },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
