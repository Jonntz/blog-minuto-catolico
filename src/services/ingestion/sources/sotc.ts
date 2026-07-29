/**
 * Fonte: Sign of the Cross Media — https://www.signofthecrossmedia.com/feed/
 *
 * WordPress 6.9.5, 25 itens. Levantamento ao vivo (27/07/2026):
 *   - traz `description` (excerpt de 146–645 chars), várias `category`
 *     (inclusive hashtags de campanha) e `pubDate`;
 *   - `dc:creator` quase sempre vem VAZIO;
 *   - `guid` tem `isPermaLink="false"` e aponta para `dev1.signofthecrossmedia.com`
 *     — NUNCA usar como URL; o `dedupeHash` sai do `<link>`;
 *   - **não tem `content:encoded` e não tem imagem nenhuma**;
 *   - a WP REST API responde 401 — não insistir.
 *
 * Por isso existe a segunda fase (`enriquecerSotc`): buscar a página do artigo e
 * ler `og:image`/`og:description`. Isso custa uma requisição POR ARTIGO, então
 * ela é limitada por execução e alimentada por uma fila no próprio banco — em
 * regime normal são 0–3 itens novos a cada 15 min.
 *
 * Esta fonte fica atrás da flag `SOURCE_SOTC_ENABLED`: o robots.txt deles bloqueia
 * crawlers de IA nominalmente e a intenção declarada é contrária, ainda que a
 * regra `*` nos permita. Risco aceito conscientemente — ver MEMORY.md §2.3.
 */

import { and, desc, eq, gt, isNull, lt, or } from "drizzle-orm";
import type { Db } from "@/db";
import { articles } from "@/db/schema";
import { mapearCategoria } from "@/lib/categories";
import { canonicalizarUrlSegura } from "@/lib/hash";
import { ACCEPT_FEED, ACCEPT_HTML, buscarTexto } from "../http";
import { extrairCorpoArtigo } from "../article-body";
import { extrairOpenGraph } from "../meta";
import { textoLimpo, paraUnixSegundos, truncar } from "../normalize";
import { podeBuscar } from "../robots";
import { analisarRss, type ItemRss } from "../rss";
import type { ColetaDaFonte, ContextoIngestao, ItemNormalizado } from "../types";

export const FEED_SOTC = "https://www.signofthecrossmedia.com/feed/";
export const NOME_SOTC = "Sign of the Cross Media";

const LIMITE_MATERIA_PRIMA = 6_000;

/** Teto de páginas de artigo lidas por execução — protege a fonte e o Worker. */
const MAX_ENRIQUECIMENTOS = 12;

/**
 * Janela da fila de enriquecimento.
 *
 * Sem ela, um artigo que legitimamente não tem `og:image` seria rebuscado a cada
 * 15 minutos, para sempre. Com ela, some da fila depois de uma semana.
 */
const JANELA_ENRIQUECIMENTO_S = 7 * 24 * 60 * 60;

/**
 * Mínimo de matéria-prima para o pré-voo da adaptação aceitar o artigo.
 * Espelha o cálculo em `guardrails.ts`; abaixo disto adaptar exigiria inventar.
 */
const MIN_MATERIA_PRIMA = 1_750;

function normalizar(item: ItemRss, ctx: ContextoIngestao): ItemNormalizado | null {
  // O `guid` aponta para o host de desenvolvimento deles. Só o `<link>` serve.
  const urlCanonica = canonicalizarUrlSegura(item.link);
  const titulo = textoLimpo(item.titulo);
  if (!urlCanonica || !titulo) return null;

  const excerpt = textoLimpo(item.descricao);

  return {
    fonte: "sotc",
    nomeFonte: NOME_SOTC,
    urlCanonica,
    guid: item.guid,
    titulo,
    excerpt: excerpt ? truncar(excerpt, LIMITE_MATERIA_PRIMA) : undefined,
    autor: item.autor,
    tamanhoOriginal: excerpt?.length ?? 0,
    categoria: mapearCategoria({
      categorias: item.categorias,
      titulo,
      url: urlCanonica,
    }),
    tags: item.categorias,
    // Imagem não vem no feed — entra na fase de enriquecimento.
    publicadoEm: paraUnixSegundos(item.pubDate, ctx.agora),
  };
}

export async function coletarSotc(ctx: ContextoIngestao): Promise<ColetaDaFonte> {
  if (!(await podeBuscar(FEED_SOTC, ctx.userAgent))) {
    throw new Error(`robots.txt do Sign of the Cross proíbe ${FEED_SOTC}`);
  }

  const xml = await buscarTexto(FEED_SOTC, {
    userAgent: ctx.userAgent,
    accept: ACCEPT_FEED,
  });

  const feed = analisarRss(xml);
  const itens: ItemNormalizado[] = [];
  let descartados = 0;

  for (const bruto of feed.itens) {
    const item = normalizar(bruto, ctx);
    if (item) itens.push(item);
    else descartados++;
  }

  return { itens, descartados };
}

export interface ResumoEnriquecimento {
  tentados: number;
  enriquecidos: number;
  falhas: number;
}

/**
 * Segunda fase: preenche imagem e descrição lendo o `<head>` da página.
 *
 * A fila é uma consulta só — artigos do SOTC sem imagem, dentro da janela,
 * mais recentes primeiro. Isso cobre de uma vez os itens recém-inseridos E o
 * atraso acumulado da primeira execução (25 itens de uma vez), que se resolve
 * sozinho ao longo de algumas rodadas do cron, sem martelar a fonte.
 */
export async function enriquecerSotc(
  db: Db,
  ctx: ContextoIngestao,
): Promise<ResumoEnriquecimento> {
  const pendentes = await db
    .select({
      id: articles.id,
      sourceUrl: articles.sourceUrl,
      sourceExcerpt: articles.sourceExcerpt,
    })
    .from(articles)
    .where(
      and(
        eq(articles.source, "sotc"),
        // Falta imagem OU falta matéria-prima suficiente para adaptar.
        // A segunda condição é o que traz para a fila os artigos que já têm
        // og:image mas continuam com o excerpt curto do feed — sem ela, eles
        // ficariam presos em `draft` para sempre, reprovados no pré-voo.
        or(
          isNull(articles.imageUrl),
          lt(articles.sourceLength, MIN_MATERIA_PRIMA),
        ),
        gt(articles.fetchedAt, ctx.agora - JANELA_ENRIQUECIMENTO_S),
      ),
    )
    .orderBy(desc(articles.publishedAt))
    .limit(MAX_ENRIQUECIMENTOS);

  const resumo: ResumoEnriquecimento = {
    tentados: pendentes.length,
    enriquecidos: 0,
    falhas: 0,
  };

  for (const pendente of pendentes) {
    try {
      if (!(await podeBuscar(pendente.sourceUrl, ctx.userAgent))) {
        // Não é falha: é a fonte dizendo não. Registra e segue.
        console.warn(
          JSON.stringify({ evento: "robots_negou_artigo", url: pendente.sourceUrl }),
        );
        continue;
      }

      const html = await buscarTexto(pendente.sourceUrl, {
        userAgent: ctx.userAgent,
        accept: ACCEPT_HTML,
      });
      const og = extrairOpenGraph(html);

      const imagem = canonicalizarUrlSegura(og.imagem);
      const descricao = textoLimpo(og.descricao);

      /**
       * Corpo da matéria a partir do HTML da página.
       *
       * Sem isto o SOTC é inadaptável: o feed traz excerpt de 49 a 709
       * caracteres e o pré-voo da adaptação exige 1.750 — medido, **0 de 25
       * matérias passavam**. Com o corpo extraído (≈4.000 caracteres numa
       * página típica) o material bruto fica equivalente ao `content:encoded`
       * do EWTN, e o SOTC passa a render matéria como a outra fonte.
       *
       * Isto é matéria-prima para adaptação, NUNCA publicada como está — os
       * guard-rails de proporção garantem (CLAUDE.md §6).
       */
      const corpo = extrairCorpoArtigo(html);
      const textoCorpo = corpo && corpo.texto.length > 400 ? corpo.texto : null;

      if (!imagem && !descricao && !textoCorpo) continue;

      // Ordem de preferência da matéria-prima: corpo completo > descrição do
      // og > excerpt do feed. Só substitui quando acrescenta conteúdo.
      const excerptAtual = pendente.sourceExcerpt ?? "";
      const candidato =
        textoCorpo && textoCorpo.length > excerptAtual.length
          ? textoCorpo
          : descricao && descricao.length > excerptAtual.length
            ? descricao
            : undefined;

      await db
        .update(articles)
        .set({
          ...(imagem ? { imageUrl: imagem } : {}),
          ...(candidato
            ? {
                sourceExcerpt: truncar(candidato, LIMITE_MATERIA_PRIMA),
                sourceLength: candidato.length,
              }
            : {}),
          updatedAt: ctx.agora,
        })
        .where(eq(articles.id, pendente.id));

      if (imagem) resumo.enriquecidos++;
    } catch (erro) {
      resumo.falhas++;
      console.warn(
        JSON.stringify({
          evento: "enriquecimento_falhou",
          url: pendente.sourceUrl,
          erro: erro instanceof Error ? erro.message : String(erro),
        }),
      );
    }
  }

  return resumo;
}
