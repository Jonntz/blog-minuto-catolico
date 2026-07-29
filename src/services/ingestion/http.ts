/**
 * Cliente HTTP da ingestão — educado por construção.
 *
 * CLAUDE.md §6 exige identificação própria e "nunca sobrecarregar os sites de
 * origem". Aqui isso é estrutural, não uma promessa: TODA requisição da
 * ingestão passa por este módulo, que serializa por host e impõe um intervalo
 * mínimo entre acessos ao mesmo host. Não existe caminho paralelo.
 */

/** Intervalo mínimo entre duas requisições ao MESMO host. */
const INTERVALO_MINIMO_MS = 1200;

/** Requisição pendurada é pior que requisição falha: o cron inteiro trava. */
const TIMEOUT_PADRAO_MS = 15_000;

/** Uma única retentativa — mais que isso vira martelada no servidor da fonte. */
const TENTATIVAS = 2;
const ESPERA_RETENTATIVA_MS = 2_000;

/** Fila por host: cada promessa espera a anterior terminar. */
const filaPorHost = new Map<string, Promise<unknown>>();
/** Instante do último acesso a cada host. */
const ultimoAcessoPorHost = new Map<string, number>();

function dormir(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executa `tarefa` respeitando o rate limit do host.
 *
 * A fila é uma corrente de promessas por host. O `.catch()` ao guardar a
 * corrente é essencial: sem ele, uma falha envenenaria a fila e toda requisição
 * seguinte ao mesmo host rejeitaria sem nem tentar.
 */
async function comRateLimit<T>(host: string, tarefa: () => Promise<T>): Promise<T> {
  const anterior = filaPorHost.get(host) ?? Promise.resolve();

  const atual = anterior.then(async () => {
    const ultimo = ultimoAcessoPorHost.get(host) ?? 0;
    const espera = INTERVALO_MINIMO_MS - (Date.now() - ultimo);
    if (espera > 0) await dormir(espera);
    ultimoAcessoPorHost.set(host, Date.now());
    return tarefa();
  });

  filaPorHost.set(
    host,
    atual.then(
      () => undefined,
      () => undefined,
    ),
  );

  return atual;
}

export interface OpcoesBusca {
  userAgent: string;
  /** `application/rss+xml...` para feeds, `text/html...` para páginas. */
  accept: string;
  timeoutMs?: number;
}

export class ErroHttp extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`HTTP ${status} em ${url}`);
    this.name = "ErroHttp";
  }
}

/**
 * GET com User-Agent próprio, timeout, rate limit por host e uma retentativa
 * para falhas transitórias (429/5xx/rede). 4xx não é retentado: repetir um 404
 * ou um 403 só gera ruído no log da fonte.
 */
export async function buscarTexto(url: string, opcoes: OpcoesBusca): Promise<string> {
  const host = new URL(url).host;
  const timeout = opcoes.timeoutMs ?? TIMEOUT_PADRAO_MS;

  let ultimoErro: unknown;

  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    try {
      return await comRateLimit(host, async () => {
        const resposta = await fetch(url, {
          method: "GET",
          headers: {
            "user-agent": opcoes.userAgent,
            accept: opcoes.accept,
            "accept-language": "en;q=0.9",
          },
          redirect: "follow",
          signal: AbortSignal.timeout(timeout),
        });

        if (!resposta.ok) throw new ErroHttp(resposta.status, url);
        return resposta.text();
      });
    } catch (erro) {
      ultimoErro = erro;
      const transitorio =
        !(erro instanceof ErroHttp) || erro.status === 429 || erro.status >= 500;
      if (!transitorio || tentativa === TENTATIVAS) break;
      await dormir(ESPERA_RETENTATIVA_MS);
    }
  }

  throw ultimoErro instanceof Error ? ultimoErro : new Error(String(ultimoErro));
}

export const ACCEPT_FEED =
  "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5";
export const ACCEPT_HTML = "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5";
export const ACCEPT_TEXTO = "text/plain, */*;q=0.5";
