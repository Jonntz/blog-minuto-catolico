import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { Db } from "@/db";
import { articles, socialPosts, type RedeSocialAuto } from "@/db/schema";
import { getSiteUrlSync } from "@/lib/env";
import type { ItemPublicado } from "@/services/translation";
import {
  montarUrlCardInstagram,
  montarUrlStoryInstagram,
  validarTextosParaInstagram,
  type ArtigoInstagram,
} from "./instagram-card";

/**
 * Automação de publicações no Feed e Stories do Instagram via Meta Graph API (Caminho 1).
 *
 * Regras principais:
 *   1. Publicações no site (`/api/cron/adapt`) disparam `publicarPublicadosNoInstagram`
 *      junto com o Telegram — assim matérias novas vão ao Feed + Story no mesmo instante.
 *   2. Somente notícias recentes entram no Feed automático: janela primária de 48h por
 *      `articles.publishedAt` (nunca `updatedAt` de backlog antigo!). Se o dia em Brasília
 *      ainda não atingiu a meta mínima diária (padrão 5) e não houver frescas `< 48h`,
 *      completa com as mais recentes até 7 dias.
 *   3. Erros globais da Meta (bloqueio `200/5258005`, token `190`, rate limit `429`, `5xx`,
 *      timeout) revertem a trava `pending` sem queimar o artigo como `failed` definitivo.
 *   4. A cada publicação no Feed (`4:5` 1080×1350), publica automaticamente um Story
 *      (`9:16` 1080×1920) com a manchete e o link visível da matéria (a Meta Graph API não
 *      suporta stickers interativos de link clicável programaticamente).
 */

const GRAPH_API_BASE = "https://graph.facebook.com/v22.0";
export const REDE_FEED: RedeSocialAuto = "instagram";
export const REDE_STORY: RedeSocialAuto = "instagram_story";

const TIMEOUT_META_MS = 12_000;
const ESPERA_INICIAL_MS = 2_500;
const ESPERA_POLL_MS = 3_000;
const MAX_POLLS_CONTAINER = 3;
const JANELA_FRESCOR_SEG = 48 * 3600;
const JANELA_COMPLEMENTO_SEG = 7 * 86_400;
const TTL_CONTAINER_SEG = 20 * 3600;
const TTL_PENDING_ORFAO_SEG = 10 * 60;
const MIN_POSTS_DIA_PADRAO = 5;
const MAX_POSTS_DIA_PADRAO = 12;
const INTERVALO_MIN_MINUTOS_PADRAO = 30;
const OFFSET_BRT_SEG = 3 * 3600;

export interface EnvInstagram {
  INSTAGRAM_ACCOUNT_ID?: string;
  INSTAGRAM_ACCESS_TOKEN?: string;
  INSTAGRAM_MIN_POSTS_DIA?: number | string;
  INSTAGRAM_MAX_POSTS_DIA?: number | string;
  INSTAGRAM_INTERVALO_MIN_MINUTOS?: number | string;
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
  rede?: RedeSocialAuto;
  articleId?: string;
  slug?: string;
  containerId?: string;
  remotePostId?: string;
  storyStatus?: "published" | "aguardando_container" | "failed" | "skipped";
  storyRemotePostId?: string;
  storyErro?: string;
  motivo?: string;
  erro?: string;
}

export interface ResumoLoteInstagram {
  status: "desativado" | "sem_elegiveis" | "processado" | "bloqueado_meta";
  publicados: number;
  storiesPublicados: number;
  emProcessamento: number;
  falhas: number;
  motivo?: string;
  resultados: ResultadoInstagram[];
}

interface ErroMetaDetalhes {
  erro: string;
  statusHttp?: number;
  code?: number;
  subcode?: number;
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

/**
 * Retorna o timestamp Unix (s) correspondente a 00:00:00 de hoje em Brasília (`UTC-3`).
 */
export function inicioDoDiaBrtSeg(agoraSeg: number): number {
  const diaBrt = Math.floor((agoraSeg - OFFSET_BRT_SEG) / 86_400);
  return diaBrt * 86_400 + OFFSET_BRT_SEG;
}

function lerNumeroEnv(
  bruto: number | string | undefined,
  padrao: number,
  min: number,
  max: number,
): number {
  if (typeof bruto === "number" && Number.isFinite(bruto)) {
    return Math.min(max, Math.max(min, Math.trunc(bruto)));
  }
  if (typeof bruto === "string" && bruto.trim() !== "") {
    const n = Number(bruto);
    if (Number.isFinite(n)) {
      return Math.min(max, Math.max(min, Math.trunc(n)));
    }
  }
  return padrao;
}

/**
 * Identifica bloqueios de conta/app, expiração de token ou indisponibilidade da
 * Meta (`200/5258005`, `190`, `429`, `5xx`, timeout) que NÃO devem queimar o
 * artigo como `failed` definitivo nem consumir a fila em vão.
 */
export function ehErroGlobalMeta(detalhes: Pick<ErroMetaDetalhes, "statusHttp" | "code" | "subcode">): boolean {
  if (detalhes.statusHttp === undefined) return true;
  if (detalhes.statusHttp === 429 || detalhes.statusHttp >= 500) return true;
  if (detalhes.code === 190) return true;
  if (detalhes.code === 200) return true;
  if (
    detalhes.code === 4 ||
    detalhes.code === 17 ||
    detalhes.code === 32 ||
    detalhes.code === 613
  ) {
    return true;
  }
  return false;
}

/**
 * Sincronização imediata chamada por `/api/cron/adapt` no mesmo instante em que
 * notícias novas vão ao ar no site e no Telegram.
 *
 * Só publica itens cujo `publishedAt` original seja recente (`<= 48h`), evitando
 * que eventuais rascunhos antigos adaptados em fila virem postagens retroativas.
 */
export async function publicarPublicadosNoInstagram(
  db: Db,
  env: EnvInstagram,
  publicados: readonly ItemPublicado[],
  opcoes: { agora?: () => number } = {},
): Promise<ResumoLoteInstagram> {
  const credenciais = extrairCredenciais(env);
  if (!credenciais) {
    return {
      status: "desativado",
      publicados: 0,
      storiesPublicados: 0,
      emProcessamento: 0,
      falhas: 0,
      motivo:
        "INSTAGRAM_ACCOUNT_ID, INSTAGRAM_ACCESS_TOKEN ou CLOUDINARY_CLOUD_NAME não configurados",
      resultados: [],
    };
  }

  const agoraSeg = (opcoes.agora ?? (() => Math.floor(Date.now() / 1000)))();
  await limparPendenciasOrfas(db, agoraSeg);

  const corteFrescor = agoraSeg - JANELA_FRESCOR_SEG;
  const idsFrescos = [...publicados]
    .filter((item) => item.publishedAt >= corteFrescor)
    .sort((a, b) => b.publishedAt - a.publishedAt)
    .map((item) => item.id);

  if (idsFrescos.length === 0) {
    return {
      status: "sem_elegiveis",
      publicados: 0,
      storiesPublicados: 0,
      emProcessamento: 0,
      falhas: 0,
      motivo: "Nenhuma matéria do lote tem publishedAt nas últimas 48h",
      resultados: [],
    };
  }

  const maxPostsDia = lerNumeroEnv(env.INSTAGRAM_MAX_POSTS_DIA, MAX_POSTS_DIA_PADRAO, 1, 50);
  const { qtdHoje } = await contarPublicacoesFeedHoje(db, agoraSeg);
  const vagas = Math.max(0, maxPostsDia - qtdHoje);

  if (vagas === 0) {
    return {
      status: "sem_elegiveis",
      publicados: 0,
      storiesPublicados: 0,
      emProcessamento: 0,
      falhas: 0,
      motivo: `Teto diário já atingido hoje (${qtdHoje}/${maxPostsDia})`,
      resultados: [],
    };
  }

  const artigos = await buscarArtigosParaFeedPorIds(db, idsFrescos, vagas);
  if (artigos.length === 0) {
    return {
      status: "sem_elegiveis",
      publicados: 0,
      storiesPublicados: 0,
      emProcessamento: 0,
      falhas: 0,
      motivo: "Matérias recentes do lote já possuem registro em social_posts",
      resultados: [],
    };
  }

  const siteUrl = getSiteUrlSync();

  // Fase 1: valida, trava e cria containers de Feed na Meta.
  interface FeedPreparado {
    artigo: ArtigoInstagram;
    socialPostId: string;
    containerId: string;
  }
  const preparadosFeed: FeedPreparado[] = [];
  const resultados: ResultadoInstagram[] = [];
  let bloqueadoMeta = false;
  let motivoBloqueio = "";

  for (const artigo of artigos) {
    const inicioItem = await iniciarFeedParaArtigo(db, {
      artigo,
      siteUrl,
      credenciais,
      agoraSeg,
    });

    if (!inicioItem.ok) {
      resultados.push(inicioItem.resultado);
      if (inicioItem.erroGlobal) {
        bloqueadoMeta = true;
        motivoBloqueio = inicioItem.resultado.erro ?? "Erro global na Meta Graph API";
        break;
      }
      continue;
    }

    preparadosFeed.push({
      artigo,
      socialPostId: inicioItem.socialPostId,
      containerId: inicioItem.containerId,
    });
  }

  if (preparadosFeed.length === 0) {
    return {
      status: bloqueadoMeta ? "bloqueado_meta" : "processado",
      publicados: 0,
      storiesPublicados: 0,
      emProcessamento: 0,
      falhas: resultados.filter((r) => r.status === "failed").length,
      motivo: bloqueadoMeta ? motivoBloqueio : undefined,
      resultados,
    };
  }

  // Única espera compartilhada para a Meta baixar e processar as imagens do lote.
  await aguardarMs(ESPERA_INICIAL_MS);

  // Fase 2: publica containers de Feed concluídos e inicia Stories correspondentes.
  interface StoryPreparado {
    artigo: ArtigoInstagram;
    socialPostId: string;
    containerId: string;
    resultadoFeed: ResultadoInstagram;
  }
  const preparadosStory: StoryPreparado[] = [];

  for (const item of preparadosFeed) {
    const resFeed = await concluirContainerExistente(db, {
      rede: REDE_FEED,
      socialPostId: item.socialPostId,
      articleId: item.artigo.id,
      slug: item.artigo.slug,
      containerId: item.containerId,
      attempts: 1,
      accountId: credenciais.accountId,
      accessToken: credenciais.accessToken,
      agoraSeg: Math.floor(Date.now() / 1000),
      maxPolls: 2,
    });

    if (resFeed.status !== "published") {
      resultados.push(resFeed);
      continue;
    }

    if (bloqueadoMeta) {
      resFeed.storyStatus = "skipped";
      resultados.push(resFeed);
      continue;
    }

    const inicioStory = await iniciarStoryParaArtigo(db, {
      artigo: item.artigo,
      siteUrl,
      credenciais,
      agoraSeg: Math.floor(Date.now() / 1000),
    });

    if (!inicioStory.ok) {
      resFeed.storyStatus = inicioStory.erroGlobal ? "skipped" : "failed";
      resFeed.storyErro = inicioStory.erro;
      resultados.push(resFeed);
      if (inicioStory.erroGlobal) {
        bloqueadoMeta = true;
      }
      continue;
    }

    preparadosStory.push({
      artigo: item.artigo,
      socialPostId: inicioStory.socialPostId,
      containerId: inicioStory.containerId,
      resultadoFeed: resFeed,
    });
  }

  // Fase 3: aguarda processamento dos Stories e publica todos no mesmo instante.
  if (preparadosStory.length > 0) {
    await aguardarMs(ESPERA_INICIAL_MS);
    for (const story of preparadosStory) {
      const resStory = await concluirContainerExistente(db, {
        rede: REDE_STORY,
        socialPostId: story.socialPostId,
        articleId: story.artigo.id,
        slug: story.artigo.slug,
        containerId: story.containerId,
        attempts: 1,
        accountId: credenciais.accountId,
        accessToken: credenciais.accessToken,
        agoraSeg: Math.floor(Date.now() / 1000),
        maxPolls: 2,
      });

      if (resStory.status === "published") {
        story.resultadoFeed.storyStatus = "published";
        story.resultadoFeed.storyRemotePostId = resStory.remotePostId;
      } else if (resStory.status === "aguardando_container") {
        story.resultadoFeed.storyStatus = "aguardando_container";
      } else {
        story.resultadoFeed.storyStatus = "failed";
        story.resultadoFeed.storyErro = resStory.erro ?? resStory.motivo;
      }
      resultados.push(story.resultadoFeed);
    }
  }

  return {
    status: bloqueadoMeta ? "bloqueado_meta" : "processado",
    publicados: resultados.filter((r) => r.status === "published").length,
    storiesPublicados: resultados.filter((r) => r.storyStatus === "published").length,
    emProcessamento: resultados.filter((r) => r.status === "aguardando_container").length,
    falhas: resultados.filter((r) => r.status === "failed").length,
    motivo: bloqueadoMeta ? motivoBloqueio : undefined,
    resultados,
  };
}

/**
 * Ciclo de manutenção e garantia de cadência mínima diária (`/api/cron/instagram`).
 *
 * Responsabilidades:
 *   1. Concluir containers pendentes (`instagram` e `instagram_story`).
 *   2. Emitir Story para qualquer post de Feed das últimas 24h que ainda não tenha Story.
 *   3. Manter a meta diária mínima (`INSTAGRAM_MIN_POSTS_DIA = 5`) de modo consistente,
 *      priorizando notícias frescas `< 48h` (por `publishedAt DESC`) e só recorrendo à
 *      janela de até 7 dias se faltarem posts para bater 5 no dia sem frescas pendentes.
 */
export async function executarCicloInstagram(
  db: Db,
  env: EnvInstagram,
  opcoes: { slug?: string; forcar?: boolean; agora?: () => number } = {},
): Promise<ResultadoInstagram> {
  const credenciais = extrairCredenciais(env);
  if (!credenciais) {
    return {
      status: "desativado",
      motivo:
        "INSTAGRAM_ACCOUNT_ID, INSTAGRAM_ACCESS_TOKEN ou CLOUDINARY_CLOUD_NAME não configurados",
    };
  }

  const agoraSeg = (opcoes.agora ?? (() => Math.floor(Date.now() / 1000)))();
  await limparPendenciasOrfas(db, agoraSeg);

  // 1. Conclui container de Feed pendente de execução anterior.
  const feedPendente = await concluirProximoContainerPendente(
    db,
    REDE_FEED,
    credenciais,
    agoraSeg,
  );
  if (feedPendente) {
    if (feedPendente.status === "published" && feedPendente.articleId) {
      const artigoStory = await buscarArtigoPorId(db, feedPendente.articleId);
      if (artigoStory) {
        const anexoStory = await publicarStoryCompletoParaArtigo(db, {
          artigo: artigoStory,
          siteUrl: getSiteUrlSync(),
          credenciais,
          agoraSeg: Math.floor(Date.now() / 1000),
        });
        feedPendente.storyStatus = anexoStory.status;
        feedPendente.storyRemotePostId = anexoStory.remotePostId;
        feedPendente.storyErro = anexoStory.erro;
      }
    }
    return feedPendente;
  }

  // 2. Conclui container de Story pendente.
  const storyPendente = await concluirProximoContainerPendente(
    db,
    REDE_STORY,
    credenciais,
    agoraSeg,
  );
  if (storyPendente) {
    return storyPendente;
  }

  // 3. Publica Story para Feed recente (< 24h) que ainda não teve Story pareado.
  const siteUrl = getSiteUrlSync();
  const feedSemStory = await buscarFeedRecenteSemStory(db, agoraSeg);
  if (feedSemStory) {
    const storyRes = await publicarStoryCompletoParaArtigo(db, {
      artigo: feedSemStory,
      siteUrl,
      credenciais,
      agoraSeg,
    });
    return {
      status:
        storyRes.status === "published"
          ? "published"
          : storyRes.status === "aguardando_container"
            ? "aguardando_container"
            : "failed",
      rede: REDE_STORY,
      articleId: feedSemStory.id,
      slug: feedSemStory.slug,
      remotePostId: storyRes.remotePostId,
      storyStatus: storyRes.status,
      storyRemotePostId: storyRes.remotePostId,
      erro: storyRes.erro,
      motivo:
        storyRes.status === "published"
          ? "Story pareado publicado para matéria recente do Feed"
          : undefined,
    };
  }

  // 4. Controle de meta diária (mínimo 5/dia, teto configurável) e intervalo.
  const minPostsDia = lerNumeroEnv(env.INSTAGRAM_MIN_POSTS_DIA, MIN_POSTS_DIA_PADRAO, 1, 20);
  const maxPostsDia = Math.max(
    minPostsDia,
    lerNumeroEnv(env.INSTAGRAM_MAX_POSTS_DIA, MAX_POSTS_DIA_PADRAO, 1, 50),
  );
  const intervaloMinSeg =
    lerNumeroEnv(
      env.INSTAGRAM_INTERVALO_MIN_MINUTOS,
      INTERVALO_MIN_MINUTOS_PADRAO,
      0,
      1440,
    ) * 60;

  if (!opcoes.forcar) {
    const { qtdHoje, ultimoPubSeg } = await contarPublicacoesFeedHoje(db, agoraSeg);

    if (qtdHoje >= maxPostsDia) {
      return {
        status: "em_espera",
        rede: REDE_FEED,
        motivo: `Limite diário atingido hoje (${qtdHoje}/${maxPostsDia} posts em BRT)`,
      };
    }

    // Só impõe intervalo mínimo quando a meta mínima diária (>= 5) já foi batida.
    if (qtdHoje >= minPostsDia && ultimoPubSeg !== null) {
      const decorrido = agoraSeg - ultimoPubSeg;
      if (decorrido < intervaloMinSeg) {
        const faltaMin = Math.ceil((intervaloMinSeg - decorrido) / 60);
        return {
          status: "em_espera",
          rede: REDE_FEED,
          motivo: `Meta mínima diária atingida (${qtdHoje}/${minPostsDia}); aguardando ${faltaMin} min até o próximo post`,
        };
      }
    }
  }

  // 5. Seleciona matéria elegível: sempre mais recente por `publishedAt`.
  let artigo = await selecionarCandidato(db, agoraSeg, {
    slug: opcoes.slug,
    janelaSeg: JANELA_FRESCOR_SEG,
  });

  if (!artigo && !opcoes.slug && !opcoes.forcar) {
    const { qtdHoje } = await contarPublicacoesFeedHoje(db, agoraSeg);
    if (qtdHoje < minPostsDia) {
      artigo = await selecionarCandidato(db, agoraSeg, {
        janelaSeg: JANELA_COMPLEMENTO_SEG,
      });
    }
  }

  if (!artigo) {
    return {
      status: "sem_candidatos",
      rede: REDE_FEED,
      motivo: opcoes.slug
        ? `Matéria "${opcoes.slug}" não encontrada ou já processada`
        : "Nenhuma matéria elegível encontrada",
    };
  }

  const inicioFeed = await iniciarFeedParaArtigo(db, {
    artigo,
    siteUrl,
    credenciais,
    agoraSeg,
  });

  if (!inicioFeed.ok) {
    return inicioFeed.resultado;
  }

  await aguardarMs(ESPERA_INICIAL_MS);

  const resFeed = await concluirContainerExistente(db, {
    rede: REDE_FEED,
    socialPostId: inicioFeed.socialPostId,
    articleId: artigo.id,
    slug: artigo.slug,
    containerId: inicioFeed.containerId,
    attempts: 1,
    accountId: credenciais.accountId,
    accessToken: credenciais.accessToken,
    agoraSeg: Math.floor(Date.now() / 1000),
  });

  if (resFeed.status === "published") {
    const anexoStory = await publicarStoryCompletoParaArtigo(db, {
      artigo,
      siteUrl,
      credenciais,
      agoraSeg: Math.floor(Date.now() / 1000),
    });
    resFeed.storyStatus = anexoStory.status;
    resFeed.storyRemotePostId = anexoStory.remotePostId;
    resFeed.storyErro = anexoStory.erro;
  }

  return resFeed;
}

function extrairCredenciais(env: EnvInstagram): {
  accountId: string;
  accessToken: string;
  cloudName: string;
} | null {
  const accountId = env.INSTAGRAM_ACCOUNT_ID?.trim();
  const accessToken = env.INSTAGRAM_ACCESS_TOKEN?.trim();
  const cloudName = env.CLOUDINARY_CLOUD_NAME?.trim();
  if (!accountId || !accessToken || !cloudName) return null;
  return { accountId, accessToken, cloudName };
}

async function limparPendenciasOrfas(db: Db, agoraSeg: number): Promise<void> {
  await db
    .delete(socialPosts)
    .where(
      and(
        inArray(socialPosts.network, [REDE_FEED, REDE_STORY]),
        eq(socialPosts.status, "pending"),
        isNull(socialPosts.containerId),
        lt(socialPosts.createdAt, agoraSeg - TTL_PENDING_ORFAO_SEG),
      ),
    );
}

async function contarPublicacoesFeedHoje(
  db: Db,
  agoraSeg: number,
): Promise<{ qtdHoje: number; ultimoPubSeg: number | null }> {
  const inicioDia = inicioDoDiaBrtSeg(agoraSeg);
  const recentes = await db
    .select({ publishedAt: socialPosts.publishedAt })
    .from(socialPosts)
    .where(
      and(
        eq(socialPosts.network, REDE_FEED),
        eq(socialPosts.status, "published"),
        gte(socialPosts.publishedAt, inicioDia),
      ),
    )
    .orderBy(desc(socialPosts.publishedAt));

  return {
    qtdHoje: recentes.length,
    ultimoPubSeg: recentes[0]?.publishedAt ?? null,
  };
}

async function buscarArtigosParaFeedPorIds(
  db: Db,
  ids: readonly string[],
  limite: number,
): Promise<ArtigoInstagram[]> {
  if (ids.length === 0 || limite <= 0) return [];

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
        eq(socialPosts.network, REDE_FEED),
      ),
    )
    .where(
      and(
        inArray(articles.id, [...ids]),
        eq(articles.status, "published"),
        isNotNull(articles.title),
        isNotNull(articles.dek),
        isNull(socialPosts.id),
      ),
    )
    .orderBy(desc(articles.publishedAt))
    .limit(limite);

  return linhas;
}

async function buscarArtigoPorId(
  db: Db,
  articleId: string,
): Promise<ArtigoInstagram | undefined> {
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
    .where(eq(articles.id, articleId))
    .limit(1);

  return linhas[0];
}

async function buscarFeedRecenteSemStory(
  db: Db,
  agoraSeg: number,
): Promise<ArtigoInstagram | undefined> {
  const spStory = alias(socialPosts, "sp_story");

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
    .from(socialPosts)
    .innerJoin(articles, eq(articles.id, socialPosts.articleId))
    .leftJoin(
      spStory,
      and(
        eq(spStory.articleId, socialPosts.articleId),
        eq(spStory.network, REDE_STORY),
      ),
    )
    .where(
      and(
        eq(socialPosts.network, REDE_FEED),
        eq(socialPosts.status, "published"),
        gte(socialPosts.publishedAt, agoraSeg - 24 * 3600),
        eq(articles.status, "published"),
        isNotNull(articles.title),
        isNull(spStory.id),
      ),
    )
    .orderBy(desc(socialPosts.publishedAt))
    .limit(1);

  return linhas[0];
}

/**
 * Seleciona próxima matéria elegível ordenando SEMPRE pela publicação original
 * mais recente (`articles.publishedAt DESC`), nunca por `updatedAt` de backlog.
 */
async function selecionarCandidato(
  db: Db,
  agoraSeg: number,
  opcoes: { slug?: string; janelaSeg?: number },
): Promise<ArtigoInstagram | undefined> {
  const condicaoBase = and(
    eq(articles.status, "published"),
    isNotNull(articles.title),
    isNotNull(articles.dek),
    isNull(socialPosts.id),
  );

  const condicao = opcoes.slug
    ? and(condicaoBase, eq(articles.slug, opcoes.slug))
    : and(
        condicaoBase,
        gte(
          articles.publishedAt,
          agoraSeg - (opcoes.janelaSeg ?? JANELA_FRESCOR_SEG),
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
        eq(socialPosts.network, REDE_FEED),
      ),
    )
    .where(condicao)
    .orderBy(
      desc(articles.publishedAt),
      sql`case when ${articles.imageUrl} is not null then 0 else 1 end`,
    )
    .limit(1);

  return linhas[0];
}

async function iniciarFeedParaArtigo(
  db: Db,
  params: {
    artigo: ArtigoInstagram;
    siteUrl: string;
    credenciais: { accountId: string; accessToken: string; cloudName: string };
    agoraSeg: number;
  },
): Promise<
  | { ok: true; socialPostId: string; containerId: string }
  | { ok: false; erroGlobal: boolean; resultado: ResultadoInstagram }
> {
  const { artigo, siteUrl, credenciais, agoraSeg } = params;
  const validacao = validarTextosParaInstagram(artigo, siteUrl);

  if (!validacao.ok) {
    const socialPostIdInvalido = crypto.randomUUID();
    await db
      .insert(socialPosts)
      .values({
        id: socialPostIdInvalido,
        articleId: artigo.id,
        network: REDE_FEED,
        status: "failed",
        caption: (artigo.title ?? artigo.sourceTitle).slice(0, 500),
        attempts: 1,
        error: `texto reprovado na validação PT-BR: ${validacao.motivo}`,
        createdAt: agoraSeg,
      })
      .onConflictDoNothing({
        target: [socialPosts.articleId, socialPosts.network],
      });

    return {
      ok: false,
      erroGlobal: false,
      resultado: {
        status: "failed",
        rede: REDE_FEED,
        articleId: artigo.id,
        slug: artigo.slug,
        erro: validacao.motivo,
      },
    };
  }

  const cardImageUrl = montarUrlCardInstagram({
    cloudName: credenciais.cloudName,
    siteUrl,
    artigo,
  });
  const caption = validacao.legenda;
  const altText = (
    artigo.imageCaption?.trim() ||
    artigo.title ||
    artigo.sourceTitle
  )
    .trim()
    .slice(0, 500);

  const socialPostId = crypto.randomUUID();

  const inseridos = await db
    .insert(socialPosts)
    .values({
      id: socialPostId,
      articleId: artigo.id,
      network: REDE_FEED,
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
      ok: false,
      erroGlobal: false,
      resultado: {
        status: "em_espera",
        rede: REDE_FEED,
        articleId: artigo.id,
        slug: artigo.slug,
        motivo: "Matéria já enfileirada por execução concorrente",
      },
    };
  }

  const criacao = await criarContainerMidiaFeed({
    accountId: credenciais.accountId,
    accessToken: credenciais.accessToken,
    imageUrl: cardImageUrl,
    caption,
    altText,
  });

  if (!criacao.ok) {
    if (ehErroGlobalMeta(criacao)) {
      await db.delete(socialPosts).where(eq(socialPosts.id, socialPostId));
      return {
        ok: false,
        erroGlobal: true,
        resultado: {
          status: "failed",
          rede: REDE_FEED,
          articleId: artigo.id,
          slug: artigo.slug,
          erro: criacao.erro,
        },
      };
    }

    await marcarFalha(db, socialPostId, 1, criacao.erro);
    return {
      ok: false,
      erroGlobal: false,
      resultado: {
        status: "failed",
        rede: REDE_FEED,
        articleId: artigo.id,
        slug: artigo.slug,
        erro: criacao.erro,
      },
    };
  }

  await db
    .update(socialPosts)
    .set({
      status: "container_created",
      containerId: criacao.containerId,
    })
    .where(eq(socialPosts.id, socialPostId));

  return { ok: true, socialPostId, containerId: criacao.containerId };
}

async function iniciarStoryParaArtigo(
  db: Db,
  params: {
    artigo: ArtigoInstagram;
    siteUrl: string;
    credenciais: { accountId: string; accessToken: string; cloudName: string };
    agoraSeg: number;
  },
): Promise<
  | { ok: true; socialPostId: string; containerId: string }
  | { ok: false; erroGlobal: boolean; erro: string }
> {
  const { artigo, siteUrl, credenciais, agoraSeg } = params;
  const storyImageUrl = montarUrlStoryInstagram({
    cloudName: credenciais.cloudName,
    siteUrl,
    artigo,
  });
  const baseUrl = siteUrl.replace(/\/+$/, "");
  const linkMateria = `${baseUrl}/noticia/${artigo.slug}`;
  const socialPostId = crypto.randomUUID();

  const inseridos = await db
    .insert(socialPosts)
    .values({
      id: socialPostId,
      articleId: artigo.id,
      network: REDE_STORY,
      status: "pending",
      cardImageUrl: storyImageUrl,
      caption: linkMateria,
      attempts: 1,
      createdAt: agoraSeg,
    })
    .onConflictDoNothing({
      target: [socialPosts.articleId, socialPosts.network],
    })
    .returning({ id: socialPosts.id });

  if (inseridos.length === 0) {
    return {
      ok: false,
      erroGlobal: false,
      erro: "Story já enfileirado anteriormente para este artigo",
    };
  }

  const criacao = await criarContainerMidiaStory({
    accountId: credenciais.accountId,
    accessToken: credenciais.accessToken,
    imageUrl: storyImageUrl,
  });

  if (!criacao.ok) {
    if (ehErroGlobalMeta(criacao)) {
      await db.delete(socialPosts).where(eq(socialPosts.id, socialPostId));
      return { ok: false, erroGlobal: true, erro: criacao.erro };
    }
    await marcarFalha(db, socialPostId, 1, criacao.erro);
    return { ok: false, erroGlobal: false, erro: criacao.erro };
  }

  await db
    .update(socialPosts)
    .set({
      status: "container_created",
      containerId: criacao.containerId,
    })
    .where(eq(socialPosts.id, socialPostId));

  return { ok: true, socialPostId, containerId: criacao.containerId };
}

async function publicarStoryCompletoParaArtigo(
  db: Db,
  params: {
    artigo: ArtigoInstagram;
    siteUrl: string;
    credenciais: { accountId: string; accessToken: string; cloudName: string };
    agoraSeg: number;
  },
): Promise<{
  status: "published" | "aguardando_container" | "failed" | "skipped";
  remotePostId?: string;
  erro?: string;
}> {
  const inicio = await iniciarStoryParaArtigo(db, params);
  if (!inicio.ok) {
    return {
      status: inicio.erroGlobal ? "skipped" : "failed",
      erro: inicio.erro,
    };
  }

  await aguardarMs(ESPERA_INICIAL_MS);

  const conclusao = await concluirContainerExistente(db, {
    rede: REDE_STORY,
    socialPostId: inicio.socialPostId,
    articleId: params.artigo.id,
    slug: params.artigo.slug,
    containerId: inicio.containerId,
    attempts: 1,
    accountId: params.credenciais.accountId,
    accessToken: params.credenciais.accessToken,
    agoraSeg: Math.floor(Date.now() / 1000),
    maxPolls: 2,
  });

  if (conclusao.status === "published") {
    return { status: "published", remotePostId: conclusao.remotePostId };
  }
  if (conclusao.status === "aguardando_container") {
    return { status: "aguardando_container" };
  }
  return { status: "failed", erro: conclusao.erro ?? conclusao.motivo };
}

async function concluirProximoContainerPendente(
  db: Db,
  rede: RedeSocialAuto,
  credenciais: { accountId: string; accessToken: string },
  agoraSeg: number,
): Promise<ResultadoInstagram | null> {
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
        eq(socialPosts.network, rede),
        eq(socialPosts.status, "container_created"),
      ),
    )
    .orderBy(desc(socialPosts.createdAt))
    .limit(1);

  const item = pendente[0];
  if (!item) return null;

  if (!item.containerId || agoraSeg - item.createdAt > TTL_CONTAINER_SEG) {
    await marcarFalha(
      db,
      item.id,
      item.attempts + 1,
      "Container expirado antes da publicação (> 20h)",
    );
    return null;
  }

  return await concluirContainerExistente(db, {
    rede,
    socialPostId: item.id,
    articleId: item.articleId,
    containerId: item.containerId,
    attempts: item.attempts,
    accountId: credenciais.accountId,
    accessToken: credenciais.accessToken,
    agoraSeg,
  });
}

async function concluirContainerExistente(
  db: Db,
  params: {
    rede: RedeSocialAuto;
    socialPostId: string;
    articleId: string;
    slug?: string;
    containerId: string;
    attempts: number;
    accountId: string;
    accessToken: string;
    agoraSeg: number;
    maxPolls?: number;
  },
): Promise<ResultadoInstagram> {
  const totalPolls = params.maxPolls ?? MAX_POLLS_CONTAINER;

  for (let i = 0; i < totalPolls; i++) {
    const estado = await consultarStatusContainer(
      params.containerId,
      params.accessToken,
    );

    if (!estado.ok) {
      if (ehErroGlobalMeta(estado)) {
        return {
          status: "aguardando_container",
          rede: params.rede,
          articleId: params.articleId,
          slug: params.slug,
          containerId: params.containerId,
          erro: estado.erro,
          motivo: "Erro transitório/bloqueio na Meta ao consultar container; preservado para retomada",
        };
      }
      await marcarFalha(db, params.socialPostId, params.attempts + 1, estado.erro);
      return {
        status: "failed",
        rede: params.rede,
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
        if (ehErroGlobalMeta(pub)) {
          return {
            status: "aguardando_container",
            rede: params.rede,
            articleId: params.articleId,
            slug: params.slug,
            containerId: params.containerId,
            erro: pub.erro,
            motivo: "Erro transitório/bloqueio na Meta ao publicar container; preservado para retomada",
          };
        }
        await marcarFalha(db, params.socialPostId, params.attempts + 1, pub.erro);
        return {
          status: "failed",
          rede: params.rede,
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
        rede: params.rede,
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
        rede: params.rede,
        articleId: params.articleId,
        slug: params.slug,
        containerId: params.containerId,
        erro,
      };
    }

    if (i < totalPolls - 1) {
      await aguardarMs(ESPERA_POLL_MS);
    }
  }

  const novasTentativas = params.attempts + 1;
  if (novasTentativas >= 3) {
    const erro = `Container ${params.containerId} permaneceu IN_PROGRESS após ${novasTentativas} tentativas`;
    await marcarFalha(db, params.socialPostId, novasTentativas, erro);
    return {
      status: "failed",
      rede: params.rede,
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
    rede: params.rede,
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

async function criarContainerMidiaFeed(params: {
  accountId: string;
  accessToken: string;
  imageUrl: string;
  caption: string;
  altText: string;
}): Promise<{ ok: true; containerId: string } | ({ ok: false } & ErroMetaDetalhes)> {
  const corpo = new URLSearchParams({
    image_url: params.imageUrl,
    caption: params.caption,
    alt_text: params.altText,
    access_token: params.accessToken,
  });
  return postarContainerMeta(params.accountId, corpo);
}

/**
 * Cria container de Story na Meta Graph API (`media_type=STORIES`).
 * `caption` e `alt_text` NÃO são suportados pela Meta para Stories.
 */
async function criarContainerMidiaStory(params: {
  accountId: string;
  accessToken: string;
  imageUrl: string;
}): Promise<{ ok: true; containerId: string } | ({ ok: false } & ErroMetaDetalhes)> {
  const corpo = new URLSearchParams({
    media_type: "STORIES",
    image_url: params.imageUrl,
    access_token: params.accessToken,
  });
  return postarContainerMeta(params.accountId, corpo);
}

async function postarContainerMeta(
  accountId: string,
  corpo: URLSearchParams,
): Promise<{ ok: true; containerId: string } | ({ ok: false } & ErroMetaDetalhes)> {
  try {
    const resposta = await fetch(
      `${GRAPH_API_BASE}/${encodeURIComponent(accountId)}/media`,
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: corpo.toString(),
        signal: AbortSignal.timeout(TIMEOUT_META_MS),
      },
    );

    const dados = (await resposta.json()) as RespostaIdMeta;
    if (!resposta.ok || !dados.id) {
      return {
        ok: false,
        erro: extrairErroMeta(resposta.status, dados),
        statusHttp: resposta.status,
        code: dados.error?.code,
        subcode: dados.error?.error_subcode,
      };
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
  | ({ ok: false } & ErroMetaDetalhes)
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
      return {
        ok: false,
        erro: extrairErroMeta(resposta.status, dados),
        statusHttp: resposta.status,
        code: dados.error?.code,
        subcode: dados.error?.error_subcode,
      };
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
}): Promise<{ ok: true; postId: string } | ({ ok: false } & ErroMetaDetalhes)> {
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
      return {
        ok: false,
        erro: extrairErroMeta(resposta.status, dados),
        statusHttp: resposta.status,
        code: dados.error?.code,
        subcode: dados.error?.error_subcode,
      };
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
