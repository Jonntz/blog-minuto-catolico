"use server";

import { z } from "zod";
import { getDb } from "@/db";
import { subscribers } from "@/db/schema";

/**
 * Inscrição na newsletter.
 *
 * Server Action (CLAUDE.md §3: mutações internas usam Server Actions; Route
 * Handlers ficam para consumo externo). O formulário do design funciona sem
 * JavaScript — é `<form action={...}>` puro.
 */

const esquema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Informe um e-mail válido.")
    .max(254, "E-mail longo demais."),
});

export interface EstadoNewsletter {
  ok: boolean;
  mensagem: string;
}

export async function inscrever(
  _anterior: EstadoNewsletter | null,
  formData: FormData,
): Promise<EstadoNewsletter> {
  const analise = esquema.safeParse({ email: formData.get("email") });

  if (!analise.success) {
    return {
      ok: false,
      mensagem: analise.error.issues[0]?.message ?? "E-mail inválido.",
    };
  }

  try {
    const db = await getDb();
    await db
      .insert(subscribers)
      .values({
        id: crypto.randomUUID(),
        email: analise.data.email,
        createdAt: Math.floor(Date.now() / 1000),
        source: "newsletter-home",
      })
      // Reinscrever não pode vazar que o e-mail já existe na base: isso
      // transforma o formulário num oráculo de "fulano assina este site".
      // Conflito é silencioso, e a resposta é a mesma dos dois lados.
      .onConflictDoNothing({ target: subscribers.email });

    /**
     * ⚠️ NÃO prometer e-mail de confirmação aqui.
     *
     * Esta mensagem dizia "confira sua caixa de entrada para confirmar a
     * inscrição" — e **nenhum código envia e-mail** neste projeto. A coluna
     * `confirmedAt` (`src/db/schema.ts`) existe e nunca foi escrita. Era a
     * mesma classe de defeito da política de privacidade que declarava não ter
     * publicidade: o site afirmando algo que não faz.
     *
     * Quando o double opt-in existir de verdade (o Cloudflare Email Routing
     * destrava o remetente), esta mensagem volta a falar de confirmação — e aí
     * será verdade.
     */
    return {
      ok: true,
      mensagem: "Pronto! Seu e-mail foi registrado.",
    };
  } catch (erro) {
    console.error(
      JSON.stringify({
        evento: "newsletter_falhou",
        erro: erro instanceof Error ? erro.message : String(erro),
      }),
    );
    return {
      ok: false,
      mensagem: "Não foi possível concluir agora. Tente de novo em instantes.",
    };
  }
}
