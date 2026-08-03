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
  /**
   * Service binding para o Worker da app (`minuto-catolico`).
   *
   * É por AQUI que as rotas de cron são chamadas — nunca pelo `fetch` global.
   * Ver a justificativa longa em `wrangler.jsonc`: usar HTTP público acoplava a
   * ingestão ao estado do DNS, e uma troca de domínio derrubou o pipeline
   * inteiro sem deixar rastro.
   */
  APP: Fetcher;
  /** Só monta a URL para o log. O roteamento é do binding, não do host. */
  SITE_URL: string;
  /** Compartilhado com a app; conferido por `exigirCronSecret()` na rota. */
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
  /**
   * Todo dia às 07:00 UTC (04:00 BRT): recarrega o calendário litúrgico de 1962.
   *
   * ERA MENSAL (dia 1) e isso derrubou o painel de liturgia da capa em
   * 01/08/2026. A página do Salve Maria CRESCE mês a mês: em 03/08 ela ainda
   * tinha só 7 tabelas (Jan–Jul). O disparo do dia 1º rodou, não encontrou
   * agosto, e o próximo só viria em 1º de setembro — ou seja, o site ficaria um
   * mês inteiro sem liturgia por causa de um atraso de publicação de UM dia
   * na fonte.
   *
   * Diário conserta isso sozinho: assim que a fonte publicar o mês, o painel
   * volta em no máximo 24h. O custo é um GET de ~170 KB por dia, que para um
   * WordPress é ruído estatístico — e a checagem de `robots.txt` e o UA próprio
   * continuam valendo (CLAUDE.md §6).
   *
   * Isto também torna desnecessária a antiga rede de segurança de 10 de janeiro
   * (virada de ano com a página do ano novo ainda não publicada): o disparo
   * diário cobre esse caso e qualquer outro do mesmo tipo.
   */
  "0 7 * * *": "/api/cron/liturgy",
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
    // `env.APP.fetch`, não o `fetch` global: entrega direta ao Worker da app.
    const resposta = await env.APP.fetch(url, {
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
