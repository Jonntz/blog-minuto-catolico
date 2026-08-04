"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  aceitarPublicidade,
  recusarPublicidade,
  useConsentimento,
} from "./consent-store";
import { cn } from "@/lib/utils";

/**
 * Barra de consentimento de publicidade.
 *
 * ## Duas decisões que são requisito, não estética
 *
 * **`fixed`.** Qualquer coisa em fluxo normal empurra o conteúdo para baixo ao
 * aparecer, e isso é CLS puro — a métrica que o CLAUDE.md §1 fixa em < 0.1 e
 * que o resto do projeto protege com tanto cuidado (ver o comentário de reserva
 * de proporção em `src/components/ui/article-media.tsx`).
 *
 * **Não renderiza nada até montar.** O HTML do servidor sempre diz "pendente"
 * (ver `consent-store.ts`), então renderizar direto faria o banner piscar para
 * quem já decidiu. Esperar a montagem custa um frame e elimina tanto o flash
 * quanto qualquer divergência de hidratação.
 *
 * ## Peso simétrico entre aceitar e recusar
 *
 * "Recusar" tem o mesmo tamanho, o mesmo alvo de toque e a mesma legibilidade
 * que "Aceitar". Padrão escuro (recusa escondida em letra miúda) invalida o
 * consentimento na LGPD e no GDPR — consentimento tem de ser livre. Além disso,
 * é o tipo de coisa que a revisão de compliance de uma rede de anúncios olha.
 */
export function ConsentBanner() {
  const estado = useConsentimento();
  const [montado, setMontado] = useState(false);

  useEffect(() => setMontado(true), []);

  if (!montado || estado !== "pendente") return null;

  return (
    <div
      // `role="region"` + rótulo: é conteúdo persistente e navegável, não um
      // diálogo. `alertdialog` prenderia o foco e bloquearia a leitura — o
      // texto do site continua acessível enquanto a escolha não é feita.
      role="region"
      aria-label="Aviso sobre publicidade"
      className={cn(
        "fixed inset-x-0 bottom-0 z-50",
        "border-t border-line bg-surface shadow-card",
        // `pb-[env(safe-area-inset-bottom)]` para não ficar sob a barra do
        // iOS, onde os botões viram inalcançáveis.
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-[clamp(16px,4vw,32px)] py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-[64ch] text-[14px] leading-[1.55] text-ink-2">
          Este site se mantém com publicidade. Para exibi-la, a rede parceira
          precisa receber seu endereço IP e dados do navegador.{" "}
          <strong className="font-medium text-ink">
            Nada é carregado sem a sua autorização.
          </strong>{" "}
          <Link
            href="/privacidade"
            className="text-blue-f underline decoration-from-font underline-offset-2 hover:no-underline"
          >
            Como tratamos seus dados
          </Link>
          .
        </p>

        <div className="flex shrink-0 gap-2.5">
          <button
            type="button"
            onClick={recusarPublicidade}
            className={cn(
              "min-h-11 shrink-0 touch-manipulation rounded-full border border-line bg-surface px-5 text-[14px] font-medium text-ink",
              "transition-colors duration-200 ease-dc hover:border-ink-3",
            )}
          >
            Recusar
          </button>
          <button
            type="button"
            onClick={aceitarPublicidade}
            className={cn(
              "min-h-11 shrink-0 touch-manipulation rounded-full bg-ink px-5 text-[14px] font-medium text-bg",
              "transition-[transform,opacity] duration-[350ms] ease-dc hover:-translate-y-0.5 hover:opacity-90",
            )}
          >
            Aceitar
          </button>
        </div>
      </div>
    </div>
  );
}
