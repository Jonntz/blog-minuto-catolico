"use client";

import { useEffect, useRef } from "react";
import { useConsentimento } from "@/components/consent/consent-store";
import { PUBLICIDADE_ATIVA } from "@/lib/institucional";
import { rodarBanner, useAclibPronto } from "./aclib";
import { FORMATOS, type FormatoAnuncio } from "./zonas";

/**
 * Ativa a zona de um `AdSlot`. Não renderiza nada.
 *
 * Existe separado do `AdSlot` para que o slot continue sendo Server Component:
 * o espaço reservado — que é o que protege o CLS — sai no HTML do servidor,
 * enquanto só esta folha, que não desenha pixel nenhum, é cliente. É a regra do
 * CLAUDE.md §3 ("`use client` nas folhas") aplicada literalmente.
 *
 * ## As quatro guardas do efeito
 *
 * Todas já existem em outro lugar; repetir aqui é intencional, porque este é o
 * único ponto do código que fala com a rede de anúncio:
 *
 * 1. `PUBLICIDADE_ATIVA` — o interruptor único da política (`institucional.ts`).
 * 2. `consentimento === "aceito"` — sem opt-in, nem a biblioteca foi carregada.
 * 3. `mediaQuery` — reproduz no JS o que `classesDeExibicao` faz no CSS. Rodar
 *    uma zona dentro de contêiner `display:none` gera impressão não visível,
 *    que a rede contabiliza como tráfego inválido.
 * 4. `getElementById` — se o slot não está no DOM, `runBanner` injetaria o
 *    criativo no fim do `<body>`, solto, empurrando conteúdo.
 */
export function AtivarZona({
  formato,
  blockId,
}: {
  formato: FormatoAnuncio;
  blockId: string;
}) {
  const consentimento = useConsentimento();
  const pronto = useAclibPronto();
  const { zoneId, mediaQuery } = FORMATOS[formato];

  // A biblioteca não é idempotente: chamar `runBanner` duas vezes no mesmo
  // bloco duplica o criativo. O ref sobrevive ao re-render e à dupla execução
  // de efeito do StrictMode em desenvolvimento.
  const jaRodou = useRef(false);

  useEffect(() => {
    if (!PUBLICIDADE_ATIVA) return;
    if (consentimento !== "aceito") return;
    if (!pronto || jaRodou.current) return;
    if (mediaQuery && !window.matchMedia(mediaQuery).matches) return;
    if (!document.getElementById(blockId)) return;

    jaRodou.current = true;
    rodarBanner(zoneId, blockId);
  }, [consentimento, pronto, mediaQuery, zoneId, blockId]);

  return null;
}
