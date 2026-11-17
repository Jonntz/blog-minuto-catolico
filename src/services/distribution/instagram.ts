import { and, desc, eq, gte, isNotNull, isNull, or, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { articles, socialPosts } from "@/db/schema";
import { getSiteUrlSync } from "@/lib/env";
import {
  montarLegendaInstagram,
  montarUrlCardInstagram,
  type ArtigoInstagram,
} from "./instagram-card";

/**
 * Automação de publicações no Feed do Instagram via Meta Graph API (Caminho 1).
 *
 * Usa o fluxo oficial assíncrono em 2 etapas:
 *   1. `POST /v22.0/{igUserId}/media`         -> cria container com `image_url` JPEG 4:5
 *   2. `POST /v22.0/{igUserId}/media_publish` -> publica o container após `FINISHED`
 *
 * A tabela `social_posts` (índice único em `(article_id, network)`) garante
 * idempotência mesmo que dois crons concorram, e preserva o `container_id` se
 * o processamento da Meta levar mais de 9 segundos na primeira rodada.
 */

const GRAPH_API_BASE = "https://graph.facebook.com/v22.0";
const REDE = "instagram" as const;
const TIMEOUT_META_MS = 12_000;
const ESPERA_INICIAL_MS = 2_500;
const ESPERA_POLL_MS = 3_000;
const MAX_POLLS_CONTAINER = 3;
const JANELA_SELECAO_SEG = 48 * 3600;
const TTL_CONTAINER_SEG = 20 * 3600;

export interface EnvInstagram {
  INSTAGRAM_ACCOUNT_ID?: string;
  INSTAGRAM_ACCESS_TOKEN?: string;
  INSTAGRAM_MAX_POSTS_DIA?: number;
  INSTAGRAM_INTERVALO_MIN_MINUTOS?: number;
  CLOUDINARY_CLOUD_NAME?: string;
}

export interface ResultadoInstagram {
  status:
    | "desativado"
    | "em_espera"
    | "sem_candidatos"
    | "aguardando_container"
    | "published"
    | "failed";
  articleId?: string;
  slug?: string;
  containerId?: string;
  remotePostId?: string;
  motivo?: string;
  erro?: string;
}

interface RespostaErroMeta {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
}

interface RespostaIdMeta extends RespostaErroMeta {
  id?: string;
}

interface RespostaStatusContainerMeta extends RespostaErroMeta {
  id?: string;
  status_code?: "EXPIRED" | "ERROR" | "FINISHED" | "IN_PROGRESS" | "PUBLISHED";
}

export async function executarCicloInstagram(
  db: Db,
  env: EnvInstagram,
  opcoes: { slug?: string; forcar?: boolean; agora?: () => number } = {},
): Promise<ResultadoInstagram> {
  const accountId = env.INSTAGRAM_ACCOUNT_ID?.trim();
  const accessToken = env.INSTAGRAM_ACCESS_TOKEN?.trim();
  const cloudName = env.CLOUDINARY_CLOUD_NAME?.trim();

  if (!accountId || !accessToken || !cloudName) {
    return {
      status: "desativado",
      motivo:
        "INSTAGRAM_ACCOUNT_ID, INSTAGRAM_ACCESS_TOKEN ou CLOUDINARY_CLOUD_NAME não configurados",
    };
  }

  const agoraSeg = (opcoes.agora ?? (() => Math.floor(Date.now() / 1000)))();

  // 1. Tenta concluir qualquer container pendente de rodada anterior antes de
  //    escolher uma matéria nova.
  const pendente = await db
    .select({
      id: socialPosts.id,
      articleId: socialPosts.articleId,
      containerId: socialPosts.containerId,
      attempts: socialPosts.attempts,
      createdAt: socialPosts.createdAt,
    })
    .from(socialPosts)
    .where(
      and(
        eq(socialPosts.network, REDE),
        eq(socialPosts.status, "container_created"),
      ),
    )
    .orderBy(desc(socialPosts.createdAt))
    .limit(1);

  if (pendente[0]) {
    const item = pendente[0];
    if (!item.containerId || agoraSeg - item.createdAt > TTL_CONTAINER_SEG) {
      await marcarFalha(
        db,
        item.id,
        item.attempts + 1,
        "Container expirado antes da publicação (> 20h)",
      );
    } else {
      return await concluirContainerExistente(db, {
        socialPostId: item.id,
        articleId: item.articleId,
        containerId: item.containerId,
        attempts: item.attempts,
        accountId,
        accessToken,
        agoraSeg,
      });
    }
  }

  // 2. Controle anti-spam: teto nas últimas 24h e intervalo mínimo entre posts.
  const maxPostsDia = env.INSTAGRAM_MAX_POSTS_DIA ?? 5;
  const intervaloMinSeg = (env.INSTAGRAM_INTERVALO_MIN_MINUTOS ?? 180) * 60;

  if (!opcoes.forcar) {
    const publicadosRecentes = await db
      .select({ publishedAt: socialPosts.publishedAt })
      .from(socialPosts)
      .where(
        and(
          eq(socialPosts.network, REDE),
          eq(socialPosts.status, "published"),
          gte(socialPosts.publishedAt, agoraSeg - 86_400),
        ),
      )
      .orderBy(desc(socialPosts.publishedAt));

    if (publicadosRecentes.length >= maxPostsDia) {
      return {
        status: "em_espera",
        motivo: `Limite diário atingido (${publicadosRecentes.length}/${maxPostsDia} posts nas últimas 24h)`,
      };
    }

    const ultimoPub = publicadosRecentes[0]?.publishedAt ?? null;
    if (ultimoPub !== null && agoraSeg - ultimoPub < intervaloMinSeg) {
      const faltaMin = Math.ceil((intervaloMinSeg - (agoraSeg - ultimoPub)) / 60);
      return {
        status: "em_espera",
        motivo: `Aguardando intervalo mínimo anti-spam (${faltaMin} min restantes)`,
      };
    }
  }

  // 3. Seleciona a próxima matéria publicada elegível.
  const artigo = await selecionarCandidato(db, agoraSeg, opcoes.slug);
  if (!artigo) {
    return {
      status: "sem_candidatos",
      motivo: opcoes.slug
        ? `Matéria "${opcoes.slug}" não encontrada ou já processada`
        : "Nenhuma matéria publicada elegível nas últimas 48h",
    };
  }

  const siteUrl = getSiteUrlSync();
  const cardImageUrl = montarUrlCardInstagram({ cloudName, siteUrl, artigo });
  const caption = montarLegendaInstagram(artigo, siteUrl);
  const altText = (
    artigo.imageCaption?.trim() ||
    artigo.title ||
    artigo.sourceTitle
  )
    .trim()
    .slice(0, 500);

  const socialPostId = crypto.randomUUID();

  // Trava idempotente no banco: se outra execução inseriu primeiro, aborta.
  const inseridos = await db
    .insert(socialPosts)
    .values({
      id: socialPostId,
      articleId: artigo.id,
      network: REDE,
      status: "pending",
      cardImageUrl,
      caption,
      attempts: 1,
      createdAt: agoraSeg,
    })
    .onConflictDoNothing({
      target: [socialPosts.articleId, socialPosts.network],
    })
    .returning({ id: socialPosts.id });

  if (inseridos.length === 0) {
    return {
      status: "em_espera",
      articleId: artigo.id,
      slug: artigo.slug,
      motivo: "Matéria já enfileirada por execução concorrente",
    };
  }

  // Etapa 1: cria o container de mídia na Meta.
  const criacao = await criarContainerMidia({
    accountId,
    accessToken,
    imageUrl: cardImageUrl,
    caption,
    altText,
  });

  if (!criacao.ok) {
    await marcarFalha(db, socialPostId, 1, criacao.erro);
    return {
      status: "failed",
      articleId: artigo.id,
      slug: artigo.slug,
      erro: criacao.erro,
    };
  }

  await db
    .update(socialPosts)
    .set({
      status: "container_created",
      containerId: criacao.containerId,
    })
    .where(eq(socialPosts.id, socialPostId));

  // Etapa 2: aguarda processamento da imagem pela Meta e publica no feed.
  await aguardarMs(ESPERA_INICIAL_MS);

  return await concluirContainerExistente(db, {
    socialPostId,
    articleId: artigo.id,
    slug: artigo.slug,
    containerId: criacao.containerId,
    attempts: 1,
    accountId,
    accessToken,
    agoraSeg: Math.floor(Date.now() / 1000),
  });
}

async function selecionarCandidato(
  db: Db,
  agoraSeg: number,
  slugEspecifico?: string,
): Promise<ArtigoInstagram | undefined> {
  const condicaoBase = and(
    eq(articles.status, "published"),
    isNotNull(articles.title),
    isNull(socialPosts.id),
  );

  const condicao = slugEspecifico
    ? and(condicaoBase, eq(articles.slug, slugEspecifico))
    : and(
        condicaoBase,
        or(
          gte(articles.publishedAt, agoraSeg - JANELA_SELECAO_SEG),
          gte(articles.updatedAt, agoraSeg - JANELA_SELECAO_SEG),
        ),
      );

  const linhas = await db
    .select({
      id: articles.id,
      slug: articles.slug,
      title: articles.title,
      sourceTitle: articles.sourceTitle,
      dek: articles.dek,
      bodyMd: articles.bodyMd,
      categorySlug: articles.categorySlug,
      sourceName: articles.sourceName,
      imageUrl: articles.imageUrl,
      imageCaption: articles.imageCaption,
    })
    .from(articles)
    .leftJoin(
      socialPosts,
      and(
        eq(socialPosts.articleId, articles.id),
        eq(socialPosts.network, REDE),
      ),
    )
    .where(condicao)
    .orderBy(
      // Prefere matérias que possuem foto jornalística real.
      sql`case when ${articles.imageUrl} is not null then 0 else 1 end`,
      desc(articles.updatedAt),
      desc(articles.publishedAt),
    )
    .limit(1);

  return linhas[0];
}

async function concluirContainerExistente(
  db: Db,
  params: {
    socialPostId: string;
    articleId: string;
    slug?: string;
    containerId: string;
    attempts: number;
    accountId: string;
    accessToken: string;
    agoraSeg: number;
  },
): Promise<ResultadoInstagram> {
  for (let i = 0; i < MAX_POLLS_CONTAINER; i++) {
    const estado = await consultarStatusContainer(
      params.containerId,
      params.accessToken,
    );

    if (!estado.ok) {
      await marcarFalha(db, params.socialPostId, params.attempts + 1, estado.erro);
      return {
        status: "failed",
        articleId: params.articleId,
        slug: params.slug,
        containerId: params.containerId,
        erro: estado.erro,
      };
    }

    if (estado.statusCode === "FINISHED" || estado.statusCode === "PUBLISHED") {
      const pub = await publicarContainer({
        accountId: params.accountId,
        accessToken: params.accessToken,
        containerId: params.containerId,
      });

      if (!pub.ok) {
        await marcarFalha(db, params.socialPostId, params.attempts + 1, pub.erro);
        return {
          status: "failed",
          articleId: params.articleId,
          slug: params.slug,
          containerId: params.containerId,
          erro: pub.erro,
        };
      }

      await db
        .update(socialPosts)
        .set({
          status: "published",
          remotePostId: pub.postId,
          publishedAt: params.agoraSeg,
          error: null,
        })
        .where(eq(socialPosts.id, params.socialPostId));

      return {
        status: "published",
        articleId: params.articleId,
        slug: params.slug,
        containerId: params.containerId,
        remotePostId: pub.postId,
      };
    }

    if (estado.statusCode === "ERROR" || estado.statusCode === "EXPIRED") {
      const erro = `Meta retornou status_code=${estado.statusCode} para o container ${params.containerId}`;
      await marcarFalha(db, params.socialPostId, params.attempts + 1, erro);
      return {
        status: "failed",
        articleId: params.articleId,
        slug: params.slug,
        containerId: params.containerId,
        erro,
      };
    }

    if (i < MAX_POLLS_CONTAINER - 1) {
      await aguardarMs(ESPERA_POLL_MS);
    }
  }

  const novasTentativas = params.attempts + 1;
  if (novasTentativas >= 3) {
    const erro = `Container ${params.containerId} permaneceu IN_PROGRESS após ${novasTentativas} tentativas`;
    await marcarFalha(db, params.socialPostId, novasTentativas, erro);
    return {
      status: "failed",
      articleId: params.articleId,
      slug: params.slug,
      containerId: params.containerId,
      erro,
    };
  }

  await db
    .update(socialPosts)
    .set({ attempts: novasTentativas })
    .where(eq(socialPosts.id, params.socialPostId));

  return {
    status: "aguardando_container",
    articleId: params.articleId,
    slug: params.slug,
    containerId: params.containerId,
    motivo: "Container ainda em processamento na Meta; retomará no próximo ciclo",
  };
}

async function marcarFalha(
  db: Db,
  socialPostId: string,
  attempts: number,
  erro: string,
): Promise<void> {
  await db
    .update(socialPosts)
    .set({
      status: "failed",
      attempts,
      error: erro.slice(0, 500),
    })
    .where(eq(socialPosts.id, socialPostId));
}

async function criarContainerMidia(params: {
  accountId: string;
  accessToken: string;
  imageUrl: string;
  caption: string;
  altText: string;
}): Promise<{ ok: true; containerId: string } | { ok: false; erro: string }> {
  const corpo = new URLSearchParams({
    image_url: params.imageUrl,
    caption: params.caption,
    alt_text: params.altText,
    access_token: params.accessToken,
  });

  try {
    const resposta = await fetch(
      `${GRAPH_API_BASE}/${encodeURIComponent(params.accountId)}/media`,
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: corpo.toString(),
        signal: AbortSignal.timeout(TIMEOUT_META_MS),
      },
    );

    const dados = (await resposta.json()) as RespostaIdMeta;
    if (!resposta.ok || !dados.id) {
      return { ok: false, erro: extrairErroMeta(resposta.status, dados) };
    }
    return { ok: true, containerId: dados.id };
  } catch (erro) {
    return {
      ok: false,
      erro: erro instanceof Error ? erro.message : String(erro),
    };
  }
}

async function consultarStatusContainer(
  containerId: string,
  accessToken: string,
): Promise<
  | {
      ok: true;
      statusCode: NonNullable<RespostaStatusContainerMeta["status_code"]>;
    }
  | { ok: false; erro: string }
> {
  try {
    const query = new URLSearchParams({
      fields: "status_code",
      access_token: accessToken,
    });
    const resposta = await fetch(
      `${GRAPH_API_BASE}/${encodeURIComponent(containerId)}?${query.toString()}`,
      { signal: AbortSignal.timeout(TIMEOUT_META_MS) },
    );

    const dados = (await resposta.json()) as RespostaStatusContainerMeta;
    if (!resposta.ok || !dados.status_code) {
      return { ok: false, erro: extrairErroMeta(resposta.status, dados) };
    }
    return { ok: true, statusCode: dados.status_code };
  } catch (erro) {
    return {
      ok: false,
      erro: erro instanceof Error ? erro.message : String(erro),
    };
  }
}

async function publicarContainer(params: {
  accountId: string;
  accessToken: string;
  containerId: string;
}): Promise<{ ok: true; postId: string } | { ok: false; erro: string }> {
  const corpo = new URLSearchParams({
    creation_id: params.containerId,
    access_token: params.accessToken,
  });

  try {
    const resposta = await fetch(
      `${GRAPH_API_BASE}/${encodeURIComponent(params.accountId)}/media_publish`,
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: corpo.toString(),
        signal: AbortSignal.timeout(TIMEOUT_META_MS),
      },
    );

    const dados = (await resposta.json()) as RespostaIdMeta;
    if (!resposta.ok || !dados.id) {
      return { ok: false, erro: extrairErroMeta(resposta.status, dados) };
    }
    return { ok: true, postId: dados.id };
  } catch (erro) {
    return {
      ok: false,
      erro: erro instanceof Error ? erro.message : String(erro),
    };
  }
}

function extrairErroMeta(statusHttp: number, dados: RespostaErroMeta): string {
  const err = dados.error;
  if (!err) return `Meta HTTP ${statusHttp}`;
  const sub = err.error_subcode ? `/${err.error_subcode}` : "";
  return `Meta HTTP ${statusHttp} (${err.code ?? "?"}${sub}): ${err.message ?? "erro desconhecido"}`;
}

function aguardarMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
