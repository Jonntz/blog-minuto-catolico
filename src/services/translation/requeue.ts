import { and, eq, sql } from "drizzle-orm";
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
 * conservadora de propósito: na dúvida, NÃO reprocessa.
 *
 * ## Contador de tentativas (`requeue:N`)
 *
 * Antes o módulo usava `articles.tokensIn` como contador (`tokens_in < 2`),
 * porque o Workers AI devolvia `tokensIn = null`. Com a migração para a NVIDIA
 * NIM, `tokensIn` passou a guardar os tokens reais (~3.800), o que impedia
 * qualquer artigo com consumo registrado de ser reenfileirado e corrompia a
 * telemetria de tokens. Agora o contador viaja como marcador `requeue:N` em
 * `validationErrors`, preservando `tokensIn` exclusivamente para uso de IA.
 */

const RE_MARCADOR_REQUEUE = /^requeue:(\d+)$/;

/** Lê quantas vezes o artigo já foi devolvido à fila por `requeueTransitorios`. */
export function lerTentativasRequeue(erros: readonly string[]): number {
  for (const e of erros) {
    const m = RE_MARCADOR_REQUEUE.exec(e.trim());
    if (m?.[1]) return Number.parseInt(m[1], 10);
  }
  return 0;
}

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
      ),
    )
    .limit(50);

  let devolvidos = 0;

  for (const c of candidatos) {
    const todosErros = c.validationErrors ?? [];
    const tentativas = lerTentativasRequeue(todosErros);
    if (tentativas >= MAX_TENTATIVAS) continue;

    const errosDeValidacao = todosErros.filter(
      (e) => !RE_MARCADOR_REQUEUE.test(e.trim()),
    );
    if (errosDeValidacao.length === 0) continue;

    // TODAS as causas precisam ser transitórias. Se uma única for definitiva,
    // o artigo fica onde está — reprocessar não resolveria aquela.
    const todasTransitorias = errosDeValidacao.every((e) =>
      CAUSAS_TRANSITORIAS.some((causa) => e.includes(causa)),
    );
    if (!todasTransitorias) continue;

    await db
      .update(articles)
      .set({
        status: "draft",
        validationErrors: [`requeue:${tentativas + 1}`],
        // Zera `adaptedAt` para que o item volte imediatamente à fila sem
        // esperar o cooldown de adiamento.
        adaptedAt: null,
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
