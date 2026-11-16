import { getSiteUrlSync } from "@/lib/env";
import { rotaArtigo } from "@/lib/seo";
import type { ItemPublicado } from "@/services/translation";

/**
 * Distribuição e indexação instantânea após publicar artigos.
 *
 * Toda chamada externa aqui é best-effort (timeout curto de 5s e `catch`
 * individual): uma falha no hub do WebSub, no IndexNow ou no Telegram JAMAIS
 * pode derrubar a rota `/api/cron/adapt` depois que o artigo já foi publicado e
 * gravado no D1.
 */

const WEBSUB_HUB = "https://pubsubhubbub.appspot.com/";
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
const TIMEOUT_DISTRIBUICAO_MS = 5_000;

export interface EnvDistribuicao {
  INDEXNOW_KEY?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
}

export interface ResumoDistribuicao {
  websub: "ok" | "falhou";
  indexnow: "ok" | "desativado" | "falhou";
  telegram: "ok" | "desativado" | "falhou";
}

export async function notificarPublicacao(
  publicados: readonly ItemPublicado[],
  env: EnvDistribuicao,
): Promise<ResumoDistribuicao> {
  const base = getSiteUrlSync();

  const [websub, indexnow, telegram] = await Promise.all([
    notificarWebSub(base),
    notificarIndexNow(base, publicados, env.INDEXNOW_KEY),
    notificarTelegram(base, publicados, env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID),
  ]);

  return { websub, indexnow, telegram };
}

/**
 * WebSub (PubSubHubbub) — gratuito e mantido pelo Google.
 *
 * Avisa os assinantes do `/feed.xml` (incluindo rastreadores do Google) que há
 * itens novos publicados, reduzindo o tempo de descoberta de horas para segundos.
 */
async function notificarWebSub(baseUrl: string): Promise<"ok" | "falhou"> {
  if (baseUrl.includes("localhost")) return "ok";

  try {
    const corpo = new URLSearchParams();
    corpo.append("hub.mode", "publish");
    corpo.append("hub.url", `${baseUrl}/feed.xml`);

    const resposta = await fetch(WEBSUB_HUB, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: corpo.toString(),
      signal: AbortSignal.timeout(TIMEOUT_DISTRIBUICAO_MS),
    });

    return resposta.ok ? "ok" : "falhou";
  } catch {
    return "falhou";
  }
}

/**
 * IndexNow — indexação imediata no Bing, DuckDuckGo, Yandex, Ecosia e ChatGPT Search.
 * Ativo assim que `INDEXNOW_KEY` estiver configurado no Worker e o arquivo
 * correspondente existir em `public/<INDEXNOW_KEY>.txt`.
 */
async function notificarIndexNow(
  baseUrl: string,
  publicados: readonly ItemPublicado[],
  chave?: string,
): Promise<"ok" | "desativado" | "falhou"> {
  const key = chave?.trim();
  if (!key || publicados.length === 0 || baseUrl.includes("localhost")) {
    return "desativado";
  }

  try {
    const host = new URL(baseUrl).hostname;
    const urlList = [
      baseUrl,
      ...publicados.map((p) => `${baseUrl}${rotaArtigo(p.slug)}`),
    ];

    const resposta = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key,
        keyLocation: `${baseUrl}/${key}.txt`,
        urlList,
      }),
      signal: AbortSignal.timeout(TIMEOUT_DISTRIBUICAO_MS),
    });

    return resposta.ok ? "ok" : "falhou";
  } catch {
    return "falhou";
  }
}

/**
 * Canal oficial do Telegram — publica automaticamente cada matéria nova quando
 * `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` estão configurados nos secrets.
 */
async function notificarTelegram(
  baseUrl: string,
  publicados: readonly ItemPublicado[],
  token?: string,
  chatId?: string,
): Promise<"ok" | "desativado" | "falhou"> {
  const botToken = token?.trim();
  const canal = chatId?.trim();
  if (!botToken || !canal || publicados.length === 0) {
    return "desativado";
  }

  try {
    for (const item of publicados) {
      const link = `${baseUrl}${rotaArtigo(item.slug)}?utm_source=telegram&utm_medium=social`;
      const texto = `<b>${escaparHtmlTelegram(item.title)}</b>\n\n${escaparHtmlTelegram(item.dek)}\n\n<a href="${link}">Ler no Minuto Católico →</a>`;

      const resposta = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            chat_id: canal,
            text: texto,
            parse_mode: "HTML",
            disable_web_page_preview: false,
          }),
          signal: AbortSignal.timeout(TIMEOUT_DISTRIBUICAO_MS),
        },
      );

      if (!resposta.ok) return "falhou";
    }
    return "ok";
  } catch {
    return "falhou";
  }
}

function escaparHtmlTelegram(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
