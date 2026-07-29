import { and, eq, lt, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { articles } from "@/db/schema";

/**
 * Devolve à fila os artigos reprovados por causa TRANSITÓRIA.
 *
 * Sem isto, `failed_validation` é um beco sem saída: um artigo bom reprovado
 * por um soluço de formatação do checador fica lá para sempre, e a única forma
 * de recuperá-lo é `UPDATE` manual no banco.
 *
 * A distinção entre transitório e definitivo é o coração deste módulo, e ela é
 * conservadora de propósito: na dúvida, NÃO reprocessa. Reprocessar um artigo
 * que é legitimamente ruim gasta cota de Neurons — que, medido, dá para ~34
 * artigos por dia — e ainda arrisca publicá-lo numa tentativa em que o checador
 * esteja mais permissivo.
 */

/**
 * Causas que merecem nova tentativa: o problema foi de FORMA, não de conteúdo.
 * Todas dependem de o modelo ter respondido mal, não de o texto estar errado.
 */
const CAUSAS_TRANSITORIAS = [
  // O modelo não devolveu o formato pedido (blocos ou veredito).
  "resposta_invalida",
  // O checador não produziu veredito legível.
  "checagem factual não foi produzida",
] as const;

/**
 * Causas DEFINITIVAS — nunca reprocessar:
 *  - `proporcao`: o texto é longo ou curto demais; reprocessar dá o mesmo.
 *  - `atribuicao`: falha de dado, não de modelo.
 *  - `numeros`: o modelo inventou número. Reprocessar é apostar que ele não
 *    invente de novo — e publicar número inventado é o pior erro possível
 *    num portal de notícias.
 *  - `idioma`, `recusa_do_modelo`, `rito_1962`, `glossario`: idem.
 *  - `verificacao_factual` COM divergências: houve veredito e ele apontou
 *    contradição real. Isso é conteúdo, não forma.
 */

/** Não insistir para sempre num artigo problemático. */
const MAX_TENTATIVAS = 2;

/** Notícia velha não vale reprocessar — o portal já seguiu adiante. */
const JANELA_REQUEUE_S = 3 * 24 * 60 * 60;

export interface ResumoRequeue {
  examinados: number;
  devolvidos: number;
}

export async function requeueTransitorios(
  db: Db,
  agoraSeg: number,
): Promise<ResumoRequeue> {
  const candidatos = await db
    .select({
      id: articles.id,
      validationErrors: articles.validationErrors,
      publishedAt: articles.publishedAt,
    })
    .from(articles)
    .where(
      and(
        eq(articles.status, "failed_validation"),
        sql`${articles.publishedAt} >= ${agoraSeg - JANELA_REQUEUE_S}`,
        // `tokens_in` é usado como contador de tentativas aqui: a adaptação o
        // preenche a cada passagem. Acima do teto, o artigo já teve chances.
        lt(sql`coalesce(${articles.tokensIn}, 0)`, MAX_TENTATIVAS),
      ),
    )
    .limit(50);

  let devolvidos = 0;

  for (const c of candidatos) {
    const erros = c.validationErrors ?? [];
    if (erros.length === 0) continue;

    // TODAS as causas precisam ser transitórias. Se uma única for definitiva,
    // o artigo fica onde está — reprocessar não resolveria aquela.
    const todasTransitorias = erros.every((e) =>
      CAUSAS_TRANSITORIAS.some((c) => e.includes(c)),
    );
    if (!todasTransitorias) continue;

    await db
      .update(articles)
      .set({
        status: "draft",
        validationErrors: null,
        // Incrementa o contador de tentativas.
        tokensIn: sql`coalesce(${articles.tokensIn}, 0) + 1`,
        updatedAt: agoraSeg,
      })
      .where(eq(articles.id, c.id));

    devolvidos++;
  }

  if (devolvidos > 0) {
    console.log(
      JSON.stringify({
        escopo: "translation.requeue",
        tipo: "devolvidos_a_fila",
        examinados: candidatos.length,
        devolvidos,
      }),
    );
  }

  return { examinados: candidatos.length, devolvidos };
}
