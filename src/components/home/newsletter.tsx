"use client";

import { useActionState } from "react";
import { inscrever, type EstadoNewsletter } from "@/app/actions/newsletter";
import { Container } from "@/components/ui/container";
import { cn } from "@/lib/utils";

const NOTA_PADRAO = "Sem custo. Cancele quando quiser.";

/**
 * Seção "Receba o resumo da manhã" do design.
 *
 * `"use client"` só por causa do `useActionState`, que dá o estado de envio e a
 * mensagem de retorno. O formulário continua funcionando sem JavaScript: a
 * Server Action é invocada pelo `action` do `<form>`, e sem JS o navegador faz
 * o POST normal e recarrega com a resposta.
 */
export function Newsletter() {
  const [estado, acao, enviando] = useActionState<EstadoNewsletter | null, FormData>(
    inscrever,
    null,
  );

  return (
    <Container as="section" className="py-[clamp(48px,7vw,88px)] text-center">
      <h2 className="mx-auto max-w-[22ch] font-display text-[clamp(26px,3.6vw,40px)] leading-[1.1] font-semibold tracking-[-0.03em]">
        Receba o resumo da manhã
      </h2>
      <p className="mx-auto mt-3.5 max-w-[46ch] text-[15.5px] leading-[1.55] text-ink-2">
        Cinco notícias, a liturgia do dia e um texto para rezar. Todos os dias,
        às 6h.
      </p>

      <form
        action={acao}
        className="mx-auto mt-6 flex max-w-[480px] flex-wrap justify-center gap-2.5"
      >
        <label htmlFor="newsletter-email" className="sr-only">
          E-mail
        </label>
        <input
          id="newsletter-email"
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="seu@email.com"
          aria-describedby="newsletter-nota"
          aria-invalid={estado?.ok === false || undefined}
          className="min-h-12 min-w-0 flex-[1_1_240px] rounded-full border border-line bg-surface px-[18px] text-[15px] text-ink outline-none transition-colors duration-300 placeholder:text-ink-3 focus:border-ink-3"
        />
        <button
          type="submit"
          disabled={enviando}
          className={cn(
            "min-h-12 shrink-0 rounded-full bg-ink px-[26px] text-[15px] font-medium text-bg",
            "transition-[transform,opacity] duration-[350ms] ease-dc",
            "hover:-translate-y-0.5 hover:opacity-90",
            "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0",
          )}
        >
          {enviando ? "Enviando…" : "Assinar"}
        </button>
      </form>

      <p
        id="newsletter-nota"
        // role="status" para leitores de tela anunciarem o retorno sem que o
        // foco precise sair do formulário.
        role="status"
        className={cn(
          "mt-3.5 text-xs",
          estado?.ok === false ? "text-red-f" : "text-ink-3",
        )}
      >
        {estado?.mensagem ?? NOTA_PADRAO}
      </p>
    </Container>
  );
}
