import { getUserAgent } from "@/lib/env";

/**
 * Busca da página do calendário litúrgico tradicional.
 *
 * Ética de raspagem (CLAUDE.md §6): o robots.txt do salvemaria.com.br é
 * `User-agent: * / Disallow:` — permissivo total, verificado em 2026-07-27
 * (MEMORY.md §2.3). Ainda assim nos identificamos com UA próprio, batemos
 * UMA vez por mês e não paralelizamos nada. A página inteira do ano custa
 * ~170 KB; puxá-la 12 vezes por ano é ruído estatístico para a fonte.
 */

export const HOST_CALENDARIO = "https://salvemaria.com.br";

/** 30s. Um Worker não pode ficar pendurado esperando um WordPress lento. */
const TIMEOUT_MS = 30_000;

/**
 * URL do calendário de um ano.
 *
 * A página do ANO CORRENTE fica em `/calendario/` e CRESCE ao longo do ano —
 * em 27/07/2026 tinha só 7 tabelas (Jan–Jul). É por isso que a recarga é
 * mensal e não anual: o resto do ano simplesmente ainda não foi publicado.
 * Anos passados têm URL própria e estável (`/calendario-2025`).
 */
export function urlDoCalendario(ano?: number): string {
  if (ano === undefined) return `${HOST_CALENDARIO}/calendario/`;
  return `${HOST_CALENDARIO}/calendario-${ano}`;
}

export class LiturgyFetchError extends Error {
  readonly status: number | null;

  constructor(mensagem: string, status: number | null = null) {
    super(mensagem);
    this.name = "LiturgyFetchError";
    this.status = status;
  }
}

/** Baixa o HTML cru. Sem cache: quem decide a cadência é o cron, não o CDN. */
export async function baixarCalendario(url: string): Promise<string> {
  const userAgent = await getUserAgent();

  let resposta: Response;
  try {
    resposta = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "user-agent": userAgent,
        accept: "text/html,application/xhtml+xml",
        "accept-language": "pt-BR,pt;q=0.9",
      },
    });
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro);
    throw new LiturgyFetchError(`Falha de rede ao buscar ${url}: ${motivo}`);
  }

  if (!resposta.ok) {
    throw new LiturgyFetchError(
      `A fonte respondeu ${resposta.status} em ${url}`,
      resposta.status,
    );
  }

  const html = await resposta.text();

  // Um WordPress em manutenção devolve 200 com uma página de 2 KB. Sem este
  // piso, o parser levantaria "nenhuma linha encontrada" e o log culparia o
  // layout quando o problema é outro.
  if (html.length < 5_000) {
    throw new LiturgyFetchError(
      `Resposta suspeita de ${url}: ${html.length} bytes (esperado > 5 KB)`,
      resposta.status,
    );
  }

  return html;
}
