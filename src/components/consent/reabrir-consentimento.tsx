"use client";

import { reabrirEscolha, useConsentimento } from "./consent-store";
import { cn } from "@/lib/utils";

/**
 * Botão de "mudar minha escolha", usado dentro de `/privacidade`.
 *
 * Existe porque a LGPD (art. 8º, §5º) e o GDPR exigem que retirar o
 * consentimento seja tão fácil quanto darlo. Um texto dizendo "limpe os dados
 * do navegador" não cumpre isso.
 *
 * Mostra o estado atual antes de oferecer a troca: quem abre a política quer
 * saber o que escolheu, e é a única superfície do site onde essa informação
 * aparece.
 */
export function ReabrirConsentimento() {
  const estado = useConsentimento();

  const rotuloEstado =
    estado === "aceito"
      ? "Você autorizou a exibição de publicidade."
      : estado === "recusado"
        ? "Você recusou a exibição de publicidade."
        : "Você ainda não escolheu — o aviso aparece no rodapé.";

  return (
    <span className="my-4 flex flex-wrap items-center gap-3">
      <span className="text-[15px] text-ink-2">{rotuloEstado}</span>
      {estado !== "pendente" ? (
        <button
          type="button"
          onClick={reabrirEscolha}
          className={cn(
            "min-h-11 shrink-0 touch-manipulation rounded-full border border-line bg-surface px-5 text-[14px] font-medium text-ink",
            "transition-colors duration-200 ease-dc hover:border-blue-f hover:text-blue-f",
          )}
        >
          Mudar minha escolha
        </button>
      ) : null}
    </span>
  );
}
