/**
 * Gravação idempotente no D1.
 *
 * A regra do projeto: a garantia de não duplicar é o índice UNIQUE
 * `articles_dedupe_hash_idx`, NÃO um SELECT antes do INSERT. Duas execuções de
 * cron podem se sobrepor (o agendador dispara a cada 15 min e uma execução lenta
 * ainda estar rodando é normal); entre o SELECT e o INSERT cabe a execução
 * inteira da outra. Só o banco resolve isso.
 *
 * Daí o desenho:
 *   INSERT … ON CONFLICT (dedupe_hash) DO NOTHING RETURNING id
 *   - devolveu linha  → item novo;
 *   - devolveu vazio  → duplicado (conta como tal, sem erro).
 *
 * O alvo do ON CONFLICT é explícito de propósito. Um `DO NOTHING` sem alvo
 * também engoliria conflito de `slug` — e aí uma matéria DIFERENTE com título
 * parecido sumiria em silêncio. Com alvo, a colisão de slug estoura, é
 * capturada, e o item é reinserido com sufixo de desambiguação.
 */

import { and, eq, ne } from "drizzle-orm";
import type { Db } from "@/db";
import { articles } from "@/db/schema";
import {
  hashConteudoFonte,
  hashDeduplicacao,
  sufixoCurto,
} from "@/lib/hash";
import { gerarSlug, slugDeFallback, slugDesambiguado } from "@/lib/slug";
import type { ItemNormalizado } from "./types";

export interface ResumoGravacao {
  novos: number;
  duplicados: number;
  /**
   * Duplicados cujo conteúdo MUDOU na origem e foram atualizados. Subconjunto de
   * `duplicados` — não somar aos totais.
   */
  atualizados: number;
  falhas: number;
}

/**
 * Mensagem do erro e de toda a cadeia de `cause`.
 *
 * ## Por que a cadeia, e não só `.message`
 *
 * O Drizzle 0.45 embrulha o erro do driver num `DrizzleQueryError` cuja
 * `message` é `"Failed query: <SQL> params: <…>"`. O texto do SQLite —
 * `UNIQUE constraint failed: articles.slug` — fica em `cause`, e **só lá**.
 *
 * Olhar apenas `.message` foi o que matou a desambiguação de slug descrita no
 * cabeçalho deste arquivo: o SQL embrulhado contém a palavra "slug" (está na
 * lista de colunas) mas nunca contém "unique constraint failed", então o teste
 * dava falso, o erro subia, e a matéria era descartada como `gravacao_falhou`
 * a cada execução do cron — indefinidamente, porque a origem continua
 * publicando o item.
 */
function mensagensDoErro(erro: unknown): string[] {
  const mensagens: string[] = [];
  let atual: unknown = erro;

  // Limite explícito: cadeia de `cause` cíclica travaria o Worker.
  for (let i = 0; i < 5 && atual != null; i++) {
    mensagens.push(atual instanceof Error ? atual.message : String(atual));
    atual = atual instanceof Error ? atual.cause : null;
  }

  return mensagens;
}

/**
 * ⚠️ Os dois termos têm de aparecer na MESMA mensagem da cadeia.
 *
 * Concatenar tudo antes de testar reintroduziria o bug por outro caminho: o
 * embrulho do Drizzle carrega "slug" na lista de colunas, então uma violação de
 * `dedupe_hash` seria lida como colisão de slug e a matéria seria regravada com
 * sufixo — duplicando no site algo que já está publicado. O nome da coluna é
 * qualificado (`articles.slug`) pelo mesmo motivo: `source_url` também contém a
 * substring "slug" em algumas fontes.
 */
function ehColisaoDeSlug(erro: unknown): boolean {
  return mensagensDoErro(erro).some((bruta) => {
    const m = bruta.toLowerCase();
    return m.includes("unique constraint failed") && m.includes("articles.slug");
  });
}

/**
 * Refresca um item que já existe e cujo conteúdo mudou na origem.
 *
 * Um único UPDATE condicional: o `ne(sourceContentHash)` faz o banco decidir se
 * há mudança, sem SELECT prévio e sem corrida. Só campos de PROVENIÊNCIA são
 * tocados — `status`, `title`, `dek` e `bodyMd` pertencem à fase de adaptação e
 * mexer neles aqui despublicaria matéria no ar.
 */
async function refrescarSeMudou(
  db: Db,
  item: ItemNormalizado,
  dedupeHash: string,
  contentHash: string,
  agora: number,
): Promise<boolean> {
  const atualizados = await db
    .update(articles)
    .set({
      sourceContentHash: contentHash,
      sourceTitle: item.titulo,
      sourceExcerpt: item.excerpt,
      sourceAuthor: item.autor,
      sourceLength: item.tamanhoOriginal,
      imageUrl: item.imagemUrl,
      imageCredit: item.imagemCredito,
      imageCaption: item.imagemLegenda,
      updatedAt: agora,
    })
    .where(
      and(
        eq(articles.dedupeHash, dedupeHash),
        ne(articles.sourceContentHash, contentHash),
      ),
    )
    .returning({ id: articles.id });

  return atualizados.length > 0;
}

async function inserir(
  db: Db,
  item: ItemNormalizado,
  slug: string,
  dedupeHash: string,
  contentHash: string,
  agora: number,
): Promise<boolean> {
  const inseridos = await db
    .insert(articles)
    .values({
      id: crypto.randomUUID(),
      dedupeHash,
      sourceContentHash: contentHash,
      source: item.fonte,
      sourceName: item.nomeFonte,
      sourceUrl: item.urlCanonica,
      sourceGuid: item.guid,
      sourceTitle: item.titulo,
      sourceExcerpt: item.excerpt,
      sourceAuthor: item.autor,
      sourceLength: item.tamanhoOriginal,
      slug,
      categorySlug: item.categoria,
      tags: item.tags,
      imageUrl: item.imagemUrl,
      imageCredit: item.imagemCredito,
      imageCaption: item.imagemLegenda,
      // A ingestão nunca publica. A adaptação (fase C) promove o item.
      status: "draft",
      publishedAt: item.publicadoEm,
      fetchedAt: agora,
      updatedAt: agora,
    })
    .onConflictDoNothing({ target: articles.dedupeHash })
    .returning({ id: articles.id });

  return inseridos.length > 0;
}

/**
 * Grava um item. Devolve o que aconteceu, para os contadores da execução.
 */
async function gravarItem(
  db: Db,
  item: ItemNormalizado,
  agora: number,
): Promise<"novo" | "duplicado" | "atualizado"> {
  const dedupeHash = await hashDeduplicacao(item.urlCanonica);
  const contentHash = await hashConteudoFonte(item.titulo, item.excerpt);

  const slugBase = gerarSlug(item.titulo) || slugDeFallback(sufixoCurto(dedupeHash));

  let inseriu: boolean;
  try {
    inseriu = await inserir(db, item, slugBase, dedupeHash, contentHash, agora);
  } catch (erro) {
    if (!ehColisaoDeSlug(erro)) throw erro;
    // Outra matéria já ocupa este slug. O sufixo vem do dedupeHash, então é
    // determinístico: a mesma matéria produz sempre o mesmo slug alternativo.
    const alternativo = slugDesambiguado(item.titulo, sufixoCurto(dedupeHash));
    console.warn(
      JSON.stringify({
        evento: "slug_colidiu",
        fonte: item.fonte,
        slugBase,
        slugAlternativo: alternativo,
      }),
    );
    inseriu = await inserir(db, item, alternativo, dedupeHash, contentHash, agora);
  }

  if (inseriu) return "novo";

  const atualizou = await refrescarSeMudou(db, item, dedupeHash, contentHash, agora);
  return atualizou ? "atualizado" : "duplicado";
}

/**
 * Grava a coleta inteira.
 *
 * Sequencial de propósito: o rate limit já serializou a rede, e um item que
 * falha não pode derrubar os outros — cada um é contabilizado por si. Um lote
 * único (`db.batch`) seria mais rápido, mas é transacional no D1: uma colisão de
 * slug perderia o lote inteiro.
 */
export async function gravarItens(
  db: Db,
  itens: readonly ItemNormalizado[],
  agora: number,
): Promise<ResumoGravacao> {
  const resumo: ResumoGravacao = { novos: 0, duplicados: 0, atualizados: 0, falhas: 0 };

  for (const item of itens) {
    try {
      const desfecho = await gravarItem(db, item, agora);
      if (desfecho === "novo") {
        resumo.novos++;
      } else {
        resumo.duplicados++;
        if (desfecho === "atualizado") resumo.atualizados++;
      }
    } catch (erro) {
      resumo.falhas++;
      /**
       * A `causa` é o campo que importa aqui, não o `erro`.
       *
       * Logando só `erro.message` o que chegava ao Observability era o embrulho
       * do Drizzle: o SQL inteiro, os parâmetros inteiros (incluindo o texto da
       * matéria) e nenhuma pista da falha real. Diagnosticar exigiu ler o código
       * em vez do log — que é o oposto do que a §7 do CLAUDE.md pede.
       *
       * O `slice` existe porque o embrulho do Drizzle passa de 2 KB e o log é
       * amostrado quando o volume cresce; a causa real vem antes do corte.
       */
      const mensagens = mensagensDoErro(erro);
      console.error(
        JSON.stringify({
          evento: "gravacao_falhou",
          fonte: item.fonte,
          url: item.urlCanonica,
          causa: mensagens.at(-1)?.slice(0, 300),
          erro: mensagens[0]?.slice(0, 300),
        }),
      );
    }
  }

  return resumo;
}
