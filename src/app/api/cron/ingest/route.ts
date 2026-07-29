/**
 * POST /api/cron/ingest — disparo da ingestão.
 *
 * A autorização (`CRON_SECRET`) já foi validada em `src/proxy.ts`, na fronteira
 * de rede, antes da requisição chegar aqui (CLAUDE.md §3). Esta rota NÃO
 * reautentica: duplicar a checagem criaria dois lugares para errar.
 *
 * Quem chama é o Worker agendador (`workers/scheduler/`), a cada 15 min —
 * cadência alinhada ao `<ttl>15</ttl>` declarado pelo próprio EWTN.
 */

import { NextResponse } from "next/server";
import { exigirCronSecret } from "@/lib/cron-auth";
import { executarIngestao } from "@/services/ingestion/run";

export async function POST(request: Request): Promise<NextResponse> {
  const negado = await exigirCronSecret(request);
  if (negado) return negado;

  const inicio = Date.now();

  try {
    const resultado = await executarIngestao();

    // 207 quando alguma fonte falhou mas outras passaram: o agendador consegue
    // distinguir "degradado" de "quebrado" sem parsear o corpo.
    const algumaFalhou = resultado.fontes.some((f) => f.erro);
    return NextResponse.json(resultado, { status: algumaFalhou ? 207 : 200 });
  } catch (erro) {
    // Falhou antes mesmo de abrir as execuções por fonte (env inválido, D1
    // indisponível). Não há linha em `ingestion_runs` para registrar, então o
    // log estruturado é a única evidência — precisa ser completo.
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    console.error(
      JSON.stringify({
        evento: "ingestao_falhou_totalmente",
        erro: mensagem,
        durationMs: Date.now() - inicio,
      }),
    );
    return NextResponse.json(
      { ok: false, erro: mensagem, durationMs: Date.now() - inicio },
      { status: 500 },
    );
  }
}
