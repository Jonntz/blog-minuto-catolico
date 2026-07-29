import { NextResponse, type NextRequest } from "next/server";
import { exigirCronSecret } from "@/lib/cron-auth";
import { invalidarLiturgia } from "@/lib/revalidate";
import { executarIngestaoLiturgia } from "@/services/liturgy/run";

/**
 * POST /api/cron/liturgy — recarrega o calendário litúrgico de 1962.
 *
 * Autenticação: `exigirCronSecret()` na primeira linha. Ficava no `proxy.ts`,
 * mas o Next 16 força esse arquivo a rodar em Node e o adapter OpenNext não
 * suporta middleware Node — ver a nota em `src/lib/cron-auth.ts`.
 * Reautenticar seria duplicar a regra em dois lugares — e regra duplicada é
 * regra que um dia diverge.
 *
 * Cadência: mensal, disparada pelo worker agendador em `workers/scheduler/`.
 * A página do ano corrente cresce mês a mês, então uma raspagem anual deixaria
 * o calendário congelado em janeiro.
 *
 * Parâmetro opcional `?ano=2025` (ou `{"ano":2025}` no corpo) para backfill de
 * anos anteriores, que têm URL própria e estável na fonte.
 */

/** Aceita anos plausíveis; qualquer outra coisa é erro do chamador, não 500. */
const ANO_MINIMO = 2000;
const ANO_MAXIMO = 2100;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const negado = await exigirCronSecret(request);
  if (negado) return negado;

  const ano = await lerAno(request);

  if (ano === "invalido") {
    return NextResponse.json(
      { erro: `Parâmetro 'ano' inválido (esperado ${ANO_MINIMO}–${ANO_MAXIMO})` },
      { status: 400 },
    );
  }

  const resultado = await executarIngestaoLiturgia({ ano });

  /**
   * Invalidar o cache é OBRIGATÓRIO aqui.
   *
   * Sob Cache Components, gravar no D1 não faz o site mudar: a leitura está sob
   * `"use cache"` e só sai do cache por tag. Sem esta chamada, o calendário
   * ficava no banco e invisível na capa — que foi exatamente o que aconteceu em
   * produção: a home cacheou "sem liturgia" antes do primeiro cron, e continuou
   * servindo isso com 212 dias gravados. O modo de falha mais confuso possível,
   * porque o dado "está lá".
   */
  if (resultado.ok) {
    invalidarLiturgia([chaveDeHoje()]);
  }

  // 500 quando a execução falhou: o agendador precisa conseguir distinguir
  // "rodou e não achou nada" de "não rodou". Um 200 em cima de falha é como
  // uma ingestão fica quebrada por semanas sem ninguém notar.
  return NextResponse.json(resultado, { status: resultado.ok ? 200 : 500 });
}

/** Data de hoje em `America/Sao_Paulo`, no formato `YYYY-MM-DD` da tabela. */
function chaveDeHoje(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Lê o ano da query string ou do corpo JSON.
 *
 * Aceita os dois porque o agendador manda POST com corpo e um disparo manual
 * por `curl` é muito mais cômodo com query string.
 */
async function lerAno(
  request: NextRequest,
): Promise<number | undefined | "invalido"> {
  const daQuery = request.nextUrl.searchParams.get("ano");
  if (daQuery !== null) return validarAno(daQuery);

  const tipo = request.headers.get("content-type") ?? "";
  if (!tipo.includes("application/json")) return undefined;

  try {
    const corpo: unknown = await request.json();
    if (corpo === null || typeof corpo !== "object") return undefined;
    const valor = (corpo as Record<string, unknown>)["ano"];
    if (valor === undefined || valor === null) return undefined;
    return validarAno(valor);
  } catch {
    // Corpo vazio ou JSON malformado: trata como "sem ano", que é o caso do
    // cron. Não vale derrubar a execução mensal por um corpo mal serializado.
    return undefined;
  }
}

function validarAno(valor: unknown): number | "invalido" {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < ANO_MINIMO || numero > ANO_MAXIMO) {
    return "invalido";
  }
  return numero;
}
