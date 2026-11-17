import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { exigirCronSecret } from "@/lib/cron-auth";
import { getValidatedEnv } from "@/lib/env";
import { executarCicloInstagram } from "@/services/distribution/instagram";

/**
 * POST /api/cron/instagram — publica a próxima notícia elegível no feed do Instagram.
 *
 * Disparado pelo `workers/scheduler` logo após `/api/cron/adapt`, sem gastar um
 * 4º Cron Trigger no plano Workers Free (teto de 3 triggers por Worker).
 *
 * Suporta parâmetros opcionais para operação manual/testes:
 *   - `?slug=<slug-da-materia>` — tenta publicar uma matéria específica
 *   - `?forcar=true` — ignora cota/intervalo anti-spam para publicação imediata
 */
export async function POST(request: Request): Promise<NextResponse> {
  const negado = await exigirCronSecret(request);
  if (negado) return negado;

  const inicio = Date.now();
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug")?.trim() || undefined;
  const forcar = url.searchParams.get("forcar") === "true";

  try {
    const [db, env] = await Promise.all([getDb(), getValidatedEnv()]);
    const resultado = await executarCicloInstagram(db, env, { slug, forcar });

    console.log(
      JSON.stringify({
        escopo: "cron.instagram",
        duracaoMs: Date.now() - inicio,
        ...resultado,
      }),
    );

    const statusHttp = resultado.status === "failed" ? 502 : 200;
    return NextResponse.json(
      {
        ok: resultado.status !== "failed",
        duracaoMs: Date.now() - inicio,
        ...resultado,
      },
      { status: statusHttp },
    );
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    console.error(
      JSON.stringify({
        escopo: "cron.instagram",
        evento: "instagram_erro_fatal",
        duracaoMs: Date.now() - inicio,
        erro: mensagem,
      }),
    );
    return NextResponse.json(
      { ok: false, erro: mensagem },
      { status: 500 },
    );
  }
}
