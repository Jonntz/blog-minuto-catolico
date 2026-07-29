/**
 * Worker agendador do Minuto Católico.
 *
 * Por que existe como Worker separado: o worker que o OpenNext gera para a app
 * Next.js exporta apenas `fetch` — não tem handler `scheduled`. Um Cron Trigger
 * apontado para ele dispararia no vazio, silenciosamente. Este Worker tem só o
 * `scheduled`, e chama as Route Handlers da app por HTTP com o CRON_SECRET.
 *
 * Vantagem colateral: sobrevive a upgrades do OpenNext sem tocar em nada, porque
 * não depende de nenhum detalhe interno dele.
 *
 * Isto é polling, NÃO tempo real — nenhuma das fontes expõe webhook/WebSub.
 * Trade-off consciente, ver MEMORY.md §2.7.
 */

interface SchedulerEnv {
  /** URL pública da app Next.js, sem barra final. */
  SITE_URL: string;
  /** Compartilhado com a app; validado em proxy.ts antes de chegar na rota. */
  CRON_SECRET: string;
}

/** Mapa de expressão cron → rota a chamar. */
const ROTAS: Record<string, string> = {
  // A cada 15 min: ingestão das notícias.
  // Alinhado ao <ttl>15</ttl> que o próprio feed do EWTN declara.
  "*/15 * * * *": "/api/cron/ingest",
  // Adaptação 5 min depois da ingestão, para trabalhar sobre o que acabou de
  // entrar. Rota separada de propósito: buscar feed e chamar o modelo falham
  // por motivos diferentes (rede da fonte × cota de Neurons), e uma não deve
  // derrubar a outra.
  "5,20,35,50 * * * *": "/api/cron/adapt",
  // Dia 1 de cada mês, 07:00 UTC (04:00 BRT): recarrega o calendário litúrgico
  // de 1962. A página do Salve Maria cresce ao longo do ano — daí ser mensal e
  // não anual.
  "0 7 1 * *": "/api/cron/liturgy",
  // Rede de segurança de virada de ano: em 1º de janeiro a página do ano novo
  // pode ainda não estar publicada, e o disparo mensal acima voltaria de mãos
  // vazias — deixando o site sem liturgia até fevereiro. Este repete no dia 10.
  "0 7 10 1 *": "/api/cron/liturgy",
};

export default {
  async scheduled(
    event: ScheduledController,
    env: SchedulerEnv,
    ctx: ExecutionContext,
  ): Promise<void> {
    const rota = ROTAS[event.cron];

    if (!rota) {
      // Cron configurado no wrangler.jsonc sem rota correspondente aqui.
      // Falha barulhenta: falha silenciosa de ingestão é o pior cenário
      // para um portal de notícias (CLAUDE.md §4).
      console.error(
        JSON.stringify({
          evento: "cron_sem_rota",
          cron: event.cron,
          conhecidos: Object.keys(ROTAS),
        }),
      );
      return;
    }

    ctx.waitUntil(dispararRota(rota, event.cron, env));
  },
};

async function dispararRota(
  rota: string,
  cron: string,
  env: SchedulerEnv,
): Promise<void> {
  const inicio = Date.now();
  const url = `${env.SITE_URL.replace(/\/+$/, "")}${rota}`;

  try {
    const resposta = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CRON_SECRET}`,
        "User-Agent": "MinutoCatolicoScheduler/1.0",
      },
    });

    // O corpo é lido para não deixar a conexão pendurada e para logar o motivo
    // real da falha, em vez de só o status.
    const corpo = await resposta.text();

    console.log(
      JSON.stringify({
        evento: resposta.ok ? "cron_ok" : "cron_falhou",
        cron,
        rota,
        status: resposta.status,
        duracaoMs: Date.now() - inicio,
        corpo: corpo.slice(0, 500),
      }),
    );
  } catch (erro) {
    console.error(
      JSON.stringify({
        evento: "cron_erro",
        cron,
        rota,
        duracaoMs: Date.now() - inicio,
        erro: erro instanceof Error ? erro.message : String(erro),
      }),
    );
  }
}
