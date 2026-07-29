import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { exigirCronSecret } from "@/lib/cron-auth";
import { getDb, getEnv } from "@/db";
import { articles, ingestionRuns } from "@/db/schema";
import { invalidarAposPublicar } from "@/lib/revalidate";
import { adaptarPendentes, paraIngestionRun } from "@/services/translation";
import { requeueTransitorios } from "@/services/translation/requeue";

/**
 * Adaptação editorial dos artigos pendentes.
 *
 * Rota separada da ingestão de propósito: buscar feed e adaptar texto falham por
 * motivos diferentes (rede da fonte × quota de IA), e juntar as duas faria uma
 * derrubar a outra. O agendador chama as duas.
 *
 * Autenticação: `exigirCronSecret()` na primeira linha. Já foi no `proxy.ts`,
 * removido porque o OpenNext não suporta middleware Node — ver `src/lib/cron-auth.ts`.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const negado = await exigirCronSecret(request);
  if (negado) return negado;

  const inicio = Date.now();
  const db = await getDb();
  const env = await getEnv();

  // `?limite=N` para operação manual; o padrão é conservador para não torrar a
  // quota diária de Neurons numa execução só.
  const limiteBruto = new URL(request.url).searchParams.get("limite");
  const limite = limiteBruto ? Number.parseInt(limiteBruto, 10) : undefined;

  if (limiteBruto && (!Number.isFinite(limite) || limite! < 1)) {
    return NextResponse.json(
      { ok: false, erro: "limite precisa ser inteiro positivo" },
      { status: 400 },
    );
  }

  const runId = crypto.randomUUID();

  try {
    /**
     * Antes de adaptar, devolve à fila o que reprovou por causa transitória
     * (formato ilegível do modelo, checador sem veredito). Sem isto,
     * `failed_validation` é beco sem saída e artigo bom fica preso por causa de
     * um soluço de formatação. Causas de conteúdo — número inventado, idioma
     * errado, proporção — nunca voltam.
     */
    const requeue = await requeueTransitorios(db, Math.floor(inicio / 1000));

    const resumo = await adaptarPendentes(db, env, limite ? { limite } : {});
    const linha = paraIngestionRun(resumo);

    await db.insert(ingestionRuns).values({
      id: runId,
      source: "adapt",
      startedAt: Math.floor(inicio / 1000),
      finishedAt: Math.floor(Date.now() / 1000),
      durationMs: linha.durationMs,
      itemsSeen: linha.itemsSeen,
      itemsPublished: linha.itemsPublished,
      itemsFailed: linha.itemsFailed,
      error: linha.error,
    });

    // Sob Cache Components, gravar no D1 NÃO faz o site mudar. Sem isto a
    // matéria fica publicada no banco e invisível no site — o modo de falha
    // mais confuso possível, porque o dado "está lá".
    if (resumo.publicados > 0) {
      const publicados = await db
        .select({ slug: articles.slug, categorySlug: articles.categorySlug })
        .from(articles)
        .where(and(eq(articles.status, "published")))
        .limit(resumo.publicados * 2);
      invalidarAposPublicar(publicados);
    }

    return NextResponse.json({ ok: true, runId, requeue, ...resumo });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);

    await db.insert(ingestionRuns).values({
      id: runId,
      source: "adapt",
      startedAt: Math.floor(inicio / 1000),
      finishedAt: Math.floor(Date.now() / 1000),
      durationMs: Date.now() - inicio,
      error: mensagem,
    });

    console.error(
      JSON.stringify({ evento: "adapt_falhou", runId, erro: mensagem }),
    );
    return NextResponse.json({ ok: false, runId, erro: mensagem }, { status: 500 });
  }
}
