import { desc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { articles, socialPosts } from "@/db/schema";
import { getSiteUrlSync } from "@/lib/env";

/**
 * Automação oficial de envio de links clicáveis no Direct do Instagram via
 * Meta Webhooks (`comments` + `messages` / respostas a Stories).
 *
 * Fluxos suportados dentro da API oficial da Meta:
 *   1. Comentário no Feed com palavra-chave (ex.: `LER`, `LINK`, `MATÉRIA`):
 *      dispara uma **Private Reply** (`recipient: { comment_id }`) com o link
 *      clicável exato da matéria publicada.
 *   2. Resposta a um Story ou mensagem direta com pedido de link:
 *      identifica o `reply_to.story.id` em `social_posts.remote_post_id` (ou
 *      usa a matéria mais recente publicada quando enviado por DM direta) e
 *      responde com **Generic Template (`web_url`)** + link clicável direto.
 */

const GRAPH_API_BASE = "https://graph.facebook.com/v22.0";
const TIMEOUT_META_MS = 10_000;
const MAX_EVENTOS_MEMORIA = 500;

const EVENTOS_RECENTES = new Set<string>();

export interface EnvWebhookInstagram {
  INSTAGRAM_ACCOUNT_ID?: string;
  INSTAGRAM_PAGE_ID?: string;
  INSTAGRAM_ACCESS_TOKEN?: string;
  INSTAGRAM_APP_SECRET?: string;
  INSTAGRAM_WEBHOOK_VERIFY_TOKEN?: string;
}

export interface ArtigoLinkDirect {
  slug: string;
  title: string;
  dek: string | null;
  imageUrl: string | null;
}

export interface PayloadWebhookMeta {
  object?: string;
  entry?: Array<{
    id?: string;
    time?: number;
    changes?: Array<{
      field?: string;
      value?: {
        id?: string;
        text?: string;
        from?: { id?: string; username?: string };
        media?: { id?: string; media_product_type?: string };
      };
    }>;
    messaging?: Array<{
      sender?: { id?: string };
      recipient?: { id?: string };
      timestamp?: number;
      message?: {
        mid?: string;
        text?: string;
        is_echo?: boolean;
        reply_to?: {
          story?: { id?: string; url?: string };
        };
      };
    }>;
  }>;
}

export interface ResumoWebhookInstagram {
  ok: boolean;
  recebidos: number;
  respondidos: number;
  ignorados: number;
  falhas: number;
}

/**
 * Comparação em tempo constante entre strings UTF-8 para tokens de verificação
 * e hashes de assinatura.
 */
export function compararTextoSeguro(a: string, b: string): boolean {
  const bytesA = new TextEncoder().encode(a);
  const bytesB = new TextEncoder().encode(b);
  if (bytesA.length !== bytesB.length) return false;
  let diff = 0;
  for (let i = 0; i < bytesA.length; i++) {
    diff |= bytesA[i]! ^ bytesB[i]!;
  }
  return diff === 0;
}

/**
 * Verifica o cabeçalho `x-hub-signature-256` enviado pela Meta usando HMAC-SHA256
 * sobre o corpo bruto da requisição via WebCrypto.
 */
export async function validarAssinaturaWebhookMeta(
  corpoBruto: string,
  assinaturaHeader: string | null,
  appSecret: string,
): Promise<boolean> {
  if (!assinaturaHeader || !appSecret) return false;
  const prefixo = "sha256=";
  if (!assinaturaHeader.startsWith(prefixo)) return false;

  const hexRecebido = assinaturaHeader.slice(prefixo.length).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hexRecebido)) return false;

  const encoder = new TextEncoder();
  const chave = await crypto.subtle.importKey(
    "raw",
    encoder.encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const assinatura = await crypto.subtle.sign(
    "HMAC",
    chave,
    encoder.encode(corpoBruto),
  );
  const hexCalculado = Array.from(new Uint8Array(assinatura), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  return compararTextoSeguro(hexCalculado, hexRecebido);
}

/**
 * Detecta se o comentário ou resposta ao Story demonstra intenção de ler/abrir
 * a matéria (evita disparar DMs em comentários comuns como "Amém").
 */
export function ehPedidoDeLink(texto: string | undefined): boolean {
  if (!texto) return false;
  const limpo = texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (!limpo) return false;

  if (/[🔗📰]/.test(texto)) return true;

  return /\b(ler|leia|link|materia|noticia|artigo|quero|manda|envia|enviar|acesse|site|portal|texto)\b/i.test(
    limpo,
  );
}

function registrarDedupeMemoria(chave: string): boolean {
  if (EVENTOS_RECENTES.has(chave)) return false;
  if (EVENTOS_RECENTES.size >= MAX_EVENTOS_MEMORIA) {
    const primeiro = EVENTOS_RECENTES.values().next().value;
    if (primeiro) EVENTOS_RECENTES.delete(primeiro);
  }
  EVENTOS_RECENTES.add(chave);
  return true;
}

export async function processarWebhookInstagram(
  db: Db,
  env: EnvWebhookInstagram,
  payload: PayloadWebhookMeta,
): Promise<ResumoWebhookInstagram> {
  const resumo: ResumoWebhookInstagram = {
    ok: true,
    recebidos: 0,
    respondidos: 0,
    ignorados: 0,
    falhas: 0,
  };

  if (payload.object !== "instagram" || !Array.isArray(payload.entry)) {
    return resumo;
  }

  const accountId = env.INSTAGRAM_ACCOUNT_ID?.trim();
  const accessToken = env.INSTAGRAM_ACCESS_TOKEN?.trim();
  if (!accountId || !accessToken) {
    return { ...resumo, ok: false };
  }

  const pageId = env.INSTAGRAM_PAGE_ID?.trim();
  const siteUrl = getSiteUrlSync();

  for (const entry of payload.entry) {
    // 1. Comentários em publicações do Feed -> Private Reply por `comment_id`
    for (const change of entry.changes ?? []) {
      if (change.field !== "comments" || !change.value?.id) continue;
      resumo.recebidos += 1;

      const commentId = change.value.id;
      const autorId = change.value.from?.id;

      if (
        autorId === accountId ||
        !ehPedidoDeLink(change.value.text) ||
        !registrarDedupeMemoria(`comment:${commentId}`)
      ) {
        resumo.ignorados += 1;
        continue;
      }

      const artigo = await resolverArtigoParaResposta(
        db,
        change.value.media?.id,
      );
      const corpo = montarTextoPrivateReply(siteUrl, artigo);

      const envio = await enviarMensagemMeta({
        accountId,
        pageId,
        accessToken,
        payload: {
          recipient: { comment_id: commentId },
          message: { text: corpo },
        },
      });

      if (envio.ok) {
        resumo.respondidos += 1;
      } else {
        resumo.falhas += 1;
        console.error(
          JSON.stringify({
            escopo: "instagram.webhook",
            evento: "private_reply_falhou",
            commentId,
            erro: envio.erro,
          }),
        );
      }
    }

    // 2. Mensagens diretas e respostas a Stories -> DM com cartão Web URL + fallback texto
    for (const evento of entry.messaging ?? []) {
      const msg = evento.message;
      const senderId = evento.sender?.id;
      if (!msg || !senderId) continue;
      resumo.recebidos += 1;

      const chaveMsg = msg.mid
        ? `mid:${msg.mid}`
        : `dm:${senderId}:${evento.timestamp ?? 0}`;

      if (
        msg.is_echo ||
        senderId === accountId ||
        (pageId && senderId === pageId) ||
        !ehPedidoDeLink(msg.text) ||
        !registrarDedupeMemoria(chaveMsg)
      ) {
        resumo.ignorados += 1;
        continue;
      }

      const storyId = msg.reply_to?.story?.id;
      const artigo = await resolverArtigoParaResposta(db, storyId);
      const enviado = await enviarDmComBotaoOuTexto({
        accountId,
        pageId,
        accessToken,
        recipientId: senderId,
        siteUrl,
        artigo,
      });

      if (enviado.ok) {
        resumo.respondidos += 1;
      } else {
        resumo.falhas += 1;
        console.error(
          JSON.stringify({
            escopo: "instagram.webhook",
            evento: "dm_reply_falhou",
            storyId: storyId ?? null,
            erro: enviado.erro,
          }),
        );
      }
    }
  }

  return resumo;
}

async function resolverArtigoParaResposta(
  db: Db,
  mediaId: string | undefined,
): Promise<ArtigoLinkDirect | null> {
  if (mediaId) {
    const porMidia = await db
      .select({
        slug: articles.slug,
        title: articles.title,
        dek: articles.dek,
        imageUrl: articles.imageUrl,
      })
      .from(socialPosts)
      .innerJoin(articles, eq(articles.id, socialPosts.articleId))
      .where(eq(socialPosts.remotePostId, mediaId))
      .limit(1);

    const encontrado = porMidia[0];
    if (encontrado?.title) {
      return {
        slug: encontrado.slug,
        title: encontrado.title,
        dek: encontrado.dek,
        imageUrl: encontrado.imageUrl,
      };
    }
  }

  // Fallback para a última matéria publicada no portal.
  const recente = await db
    .select({
      slug: articles.slug,
      title: articles.title,
      dek: articles.dek,
      imageUrl: articles.imageUrl,
    })
    .from(articles)
    .where(eq(articles.status, "published"))
    .orderBy(desc(articles.publishedAt))
    .limit(1);

  const ultimo = recente[0];
  if (!ultimo?.title) return null;

  return {
    slug: ultimo.slug,
    title: ultimo.title,
    dek: ultimo.dek,
    imageUrl: ultimo.imageUrl,
  };
}

export function montarUrlMateriaDirect(
  siteUrl: string,
  slug: string | null | undefined,
): string {
  const base = siteUrl.replace(/\/+$/, "");
  if (!slug) {
    return `${base}/bio?utm_source=instagram&utm_medium=dm`;
  }
  return `${base}/noticia/${slug}?utm_source=instagram&utm_medium=dm`;
}

export function montarTextoPrivateReply(
  siteUrl: string,
  artigo: ArtigoLinkDirect | null,
): string {
  const base = siteUrl.replace(/\/+$/, "");
  if (!artigo) {
    return [
      "Paz e bem! Acesse as últimas notícias do Minuto Católico pelo link abaixo:",
      "",
      `👉 ${base}/bio?utm_source=instagram&utm_medium=dm`,
    ].join("\n");
  }

  const url = montarUrlMateriaDirect(siteUrl, artigo.slug);
  return [
    "Paz e bem! Aqui está o link da matéria completa:",
    "",
    `📰 ${artigo.title}`,
    "",
    `👉 ${url}`,
    "",
    `Veja também outras notícias: ${base}/bio`,
  ].join("\n");
}

async function enviarDmComBotaoOuTexto(params: {
  accountId: string;
  pageId?: string;
  accessToken: string;
  recipientId: string;
  siteUrl: string;
  artigo: ArtigoLinkDirect | null;
}): Promise<{ ok: true } | { ok: false; erro: string }> {
  const base = params.siteUrl.replace(/\/+$/, "");
  const urlMateria = montarUrlMateriaDirect(params.siteUrl, params.artigo?.slug);
  const urlBio = `${base}/bio?utm_source=instagram&utm_medium=dm`;
  const titulo = (params.artigo?.title ?? "Últimas notícias — Minuto Católico").slice(0, 80);
  const subtitulo = (
    params.artigo?.dek ?? "Toque abaixo para ler a matéria completa em português."
  ).slice(0, 80);

  const elemento: Record<string, unknown> = {
    title: titulo,
    subtitle: subtitulo,
    default_action: {
      type: "web_url",
      url: urlMateria,
    },
    buttons: [
      {
        type: "web_url",
        url: urlMateria,
        title: "Ler matéria completa",
      },
      {
        type: "web_url",
        url: urlBio,
        title: "Mais notícias",
      },
    ],
  };

  if (params.artigo?.imageUrl) {
    elemento.image_url = params.artigo.imageUrl;
  }

  const tentativaTemplate = await enviarMensagemMeta({
    accountId: params.accountId,
    pageId: params.pageId,
    accessToken: params.accessToken,
    payload: {
      recipient: { id: params.recipientId },
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "generic",
            elements: [elemento],
          },
        },
      },
    },
  });

  if (tentativaTemplate.ok) return { ok: true };

  // Reserva determinística: texto simples com URL clicável garantida.
  return await enviarMensagemMeta({
    accountId: params.accountId,
    pageId: params.pageId,
    accessToken: params.accessToken,
    payload: {
      recipient: { id: params.recipientId },
      message: {
        text: montarTextoPrivateReply(params.siteUrl, params.artigo),
      },
    },
  });
}

async function resolverTokenDaPagina(
  accountId: string,
  pageId: string | undefined,
  systemToken: string,
): Promise<{ pageId: string; pageToken: string } | null> {
  try {
    if (pageId) {
      const resp = await fetch(
        `${GRAPH_API_BASE}/${encodeURIComponent(pageId)}?fields=access_token`,
        {
          headers: { authorization: `Bearer ${systemToken}` },
          signal: AbortSignal.timeout(TIMEOUT_META_MS),
        },
      );
      if (!resp.ok) return null;
      const dados = (await resp.json()) as { access_token?: string };
      return dados.access_token ? { pageId, pageToken: dados.access_token } : null;
    }

    const resp = await fetch(
      `${GRAPH_API_BASE}/me/accounts?fields=id,access_token,instagram_business_account{id}`,
      {
        headers: { authorization: `Bearer ${systemToken}` },
        signal: AbortSignal.timeout(TIMEOUT_META_MS),
      },
    );
    if (!resp.ok) return null;
    const dados = (await resp.json()) as {
      data?: Array<{
        id?: string;
        access_token?: string;
        instagram_business_account?: { id?: string };
      }>;
    };
    const match =
      dados.data?.find((p) => p.instagram_business_account?.id === accountId) ??
      dados.data?.[0];
    return match?.id && match.access_token
      ? { pageId: match.id, pageToken: match.access_token }
      : null;
  } catch {
    return null;
  }
}

async function dispararPostMensagemMeta(
  alvoId: string,
  token: string,
  payload: Record<string, unknown>,
): Promise<
  | { ok: true }
  | { ok: false; erro: string; status?: number; code?: number }
> {
  try {
    const resposta = await fetch(
      `${GRAPH_API_BASE}/${encodeURIComponent(alvoId)}/messages`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(TIMEOUT_META_MS),
      },
    );

    if (resposta.ok) {
      return { ok: true };
    }

    const dados = (await resposta.json().catch(() => ({}))) as {
      error?: { message?: string; code?: number; error_subcode?: number };
    };
    const err = dados.error;
    const erro = err
      ? `Meta HTTP ${resposta.status} (${err.code ?? "?"}${err.error_subcode ? `/${err.error_subcode}` : ""}): ${err.message ?? "erro"}`
      : `Meta HTTP ${resposta.status}`;
    return { ok: false, erro, status: resposta.status, code: err?.code };
  } catch (erro) {
    return {
      ok: false,
      erro: erro instanceof Error ? erro.message : String(erro),
    };
  }
}

async function enviarMensagemMeta(params: {
  accountId: string;
  pageId?: string;
  accessToken: string;
  payload: Record<string, unknown>;
}): Promise<{ ok: true } | { ok: false; erro: string }> {
  const primeira = await dispararPostMensagemMeta(
    params.accountId,
    params.accessToken,
    params.payload,
  );
  if (primeira.ok) return { ok: true };

  // Se a Meta exigir Page Access Token (#210) ou nó da Página, resolve o
  // token da Página vinculada automaticamente via `/me/accounts` ou `{pageId}`.
  const precisaTokenPagina =
    primeira.code === 210 ||
    /page access token|unsupported post request/i.test(primeira.erro);

  if (precisaTokenPagina) {
    const pagina = await resolverTokenDaPagina(
      params.accountId,
      params.pageId,
      params.accessToken,
    );
    if (pagina) {
      const segunda = await dispararPostMensagemMeta(
        pagina.pageId,
        pagina.pageToken,
        params.payload,
      );
      if (segunda.ok) return { ok: true };
      return { ok: false, erro: segunda.erro };
    }
  }

  return { ok: false, erro: primeira.erro };
}
