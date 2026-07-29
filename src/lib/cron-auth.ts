import { NextResponse } from "next/server";
import { getEnv } from "@/db";

/**
 * Autorização das rotas `/api/cron/*`.
 *
 * ## Por que NÃO está em `proxy.ts`
 *
 * O `CLAUDE.md` §3 manda validar o `CRON_SECRET` na fronteira de rede, antes de
 * a requisição chegar à rota. Isso é o certo — mas é **incompatível com o alvo
 * de deploy**, e a descoberta só aparece no build do adapter:
 *
 *   1. O adapter OpenNext recusa: *"Node.js middleware is not currently
 *      supported. Consider switching to Edge Middleware."*
 *   2. Tentar `export const runtime = "edge"` no `proxy.ts` também falha:
 *      *"Route segment config is not allowed in Proxy file. Proxy always runs
 *      on Node.js runtime."*
 *
 * Ou seja, no Next 16 o `proxy.ts` é sempre Node, e o Worker não tem runtime
 * Node na fronteira de rede. Não há configuração que concilie os dois.
 *
 * A validação passou então para o topo de cada rota de cron. O que se perde:
 * a checagem acontece depois do roteamento, não antes. O que NÃO se perde: a
 * rota continua fechada, o segredo continua comparado em tempo constante, e a
 * tentativa inválida continua sendo registrada.
 *
 * **Toda rota nova em `/api/cron/` PRECISA chamar isto na primeira linha.**
 */
export async function exigirCronSecret(
  request: Request,
): Promise<NextResponse | null> {
  const { env } = { env: await getEnv() };
  const segredo = env.CRON_SECRET;

  // Sem segredo configurado a rota ficaria ABERTA — pior que falhar.
  // Falha fechada, e barulhenta o bastante para aparecer no log.
  if (!segredo) {
    console.error(
      JSON.stringify({
        evento: "cron_sem_segredo_configurado",
        rota: new URL(request.url).pathname,
      }),
    );
    return NextResponse.json({ erro: "Cron não configurado" }, { status: 500 });
  }

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }

  if (!comparaConstante(header.slice("Bearer ".length), segredo)) {
    console.warn(
      JSON.stringify({
        evento: "cron_segredo_invalido",
        rota: new URL(request.url).pathname,
        ip: request.headers.get("cf-connecting-ip") ?? "desconhecido",
      }),
    );
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }

  return null;
}

/**
 * Comparação em tempo constante.
 *
 * `a === b` sai no primeiro byte diferente, o que vaza o prefixo correto por
 * timing. Aqui o custo é sempre proporcional ao comprimento do segredo.
 */
function comparaConstante(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Ainda assim faz uma passada, para não vazar o comprimento pelo tempo.
    let descarte = 0;
    for (let i = 0; i < b.length; i++) descarte |= b.charCodeAt(i);
    return false;
  }
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) {
    diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diferenca === 0;
}
