import { NextResponse } from "next/server";
import { getEnv } from "@/db";
import { esquemaEnv } from "@/lib/env";

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
 *
 * ## A fronteira de rede existe — só que no painel, não no código
 *
 * O papel que o `proxy.ts` teria é cumprido por uma regra de WAF que bloqueia
 * `/api/cron/*` vindo da internet pública. Isso funciona sem quebrar o cron
 * porque `workers/scheduler/index.ts` chama a app por **service binding**
 * (`env.APP.fetch`), e tráfego de service binding não atravessa a borda da
 * Cloudflare — não passa por WAF nem por Cache Rules.
 *
 * Ou seja: esta função é a SEGUNDA linha de defesa, não a única. Se a regra de
 * WAF for removida do painel, ela volta a ser a única — e continua suficiente,
 * mas o log de sondagem em `cron_sem_header` fica bem mais movimentado.
 */
export async function exigirCronSecret(
  request: Request,
): Promise<NextResponse | null> {
  const env = await getEnv();
  const rota = new URL(request.url).pathname;

  /**
   * Valida SÓ o shape do `CRON_SECRET`, e não o env inteiro.
   *
   * O binding entrega a string crua, sem passar pelo zod de `src/lib/env.ts`,
   * então um segredo de 4 caracteres passaria despercebido. Mas chamar
   * `getValidatedEnv()` aqui seria repetir o erro de 03/08/2026 documentado
   * naquele arquivo: validação global acoplada derrubou `/api/cron/liturgy`
   * porque exigia uma chave de IA que a liturgia não usa. Mesma técnica de
   * `getSiteUrlSync` — reaproveitar o shape isolado.
   */
  const analise = esquemaEnv.shape.CRON_SECRET.safeParse(env.CRON_SECRET);

  // Sem segredo válido a rota ficaria ABERTA — pior que falhar.
  // Falha fechada, e barulhenta o bastante para aparecer no log.
  if (!analise.success) {
    console.error(
      JSON.stringify({
        evento: "cron_sem_segredo_configurado",
        rota,
        detalhe: analise.error.issues[0]?.message ?? "CRON_SECRET ausente",
      }),
    );
    return NextResponse.json({ erro: "Cron não configurado" }, { status: 500 });
  }

  const segredo = analise.data;

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    /**
     * Loga também quando NÃO há header.
     *
     * Antes este caminho saía calado, e o de segredo errado logo abaixo
     * registrava com IP. A assimetria tinha um efeito ruim: varredura
     * automatizada de `/api/cron/*` — que nunca manda header — passava
     * completamente invisível, justamente o padrão mais comum de sondagem.
     */
    console.warn(
      JSON.stringify({
        evento: "cron_sem_header",
        rota,
        ip: request.headers.get("cf-connecting-ip") ?? "desconhecido",
      }),
    );
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }

  if (!comparaConstante(header.slice("Bearer ".length), segredo)) {
    console.warn(
      JSON.stringify({
        evento: "cron_segredo_invalido",
        rota,
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
