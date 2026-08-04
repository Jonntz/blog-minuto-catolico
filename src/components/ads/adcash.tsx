"use client";

import Script from "next/script";
import { useConsentimento } from "@/components/consent/consent-store";
import { PUBLICIDADE_ATIVA } from "@/lib/institucional";
import { marcarAclibPronto, ORIGEM_ACLIB, SRC_ACLIB } from "./aclib";

/**
 * Carregador da Adcash — só entra depois do opt-in.
 *
 * Este componente **não sabe quais zonas existem**. Ele carrega a biblioteca e
 * avisa a store de prontidão (`aclib.ts`); cada `AdSlot` ativa a própria zona
 * quando monta. A razão está documentada em `aclib.ts`: o carregador vive no
 * layout e não desmonta ao navegar, então qualquer `runBanner` disparado daqui
 * rodaria uma vez só, na primeira página carregada.
 *
 * ## O que este arquivo NÃO faz, e por quê
 *
 * **Não usa `runAutoTag` nem `runPop`.** A versão anterior, direto no `<head>`
 * do root layout, chamava `aclib.runAutoTag` em duas zonas. Esse é o pacote
 * 4-em-1 da Adcash: pop-under, intersticial, in-page push e video slider, com
 * anti-adblock. Pop-under e intersticial estão na lista de menos preferidos do
 * Coalition for Better Ads, e intersticial intrusivo é fator de rebaixamento no
 * Google mobile — ou seja, aquele formato competia diretamente com a meta nº 1
 * do CLAUDE.md §1 ("indexação perfeita no Google News", "CLS < 0.1"). Aqui só
 * há `runBanner`, em slot com altura reservada.
 *
 * **Não emite `<script>` inline.** A inicialização vai em callback do
 * `next/script`. Isso resolve duas coisas de uma vez: elimina a corrida em que
 * o inline executava antes de `aclib` existir (`ReferenceError` no console de
 * todo visitante), e tira mais um `<script>` inline do stream RSC — o MEMORY.md
 * §5c registra que foi exatamente essa classe de construção que derrubou o site
 * inteiro em 31/07.
 *
 * **Não faz preconnect no layout.** O `<link rel="preconnect">` é renderizado
 * AQUI, dentro do ramo com consentimento. Preconnect incondicional no `<head>`
 * abriria conexão com a rede de anúncio antes do opt-in, entregando o IP do
 * visitante — o que anularia metade do sentido do banner de consentimento.
 */
export function Adcash() {
  const estado = useConsentimento();

  // Duas portas em série, e as duas precisam estar abertas: o interruptor
  // global da política e o opt-in do leitor.
  if (!PUBLICIDADE_ATIVA) return null;
  if (estado !== "aceito") return null;

  return (
    <>
      {/* Só agora — nunca antes do aceite. */}
      <link rel="preconnect" href={ORIGEM_ACLIB} crossOrigin="anonymous" />
      <Script
        id="aclib"
        src={SRC_ACLIB}
        // `afterInteractive`: depois da hidratação, fora do caminho crítico do
        // LCP. `beforeInteractive` recolocaria o bloqueio de render que este
        // arquivo existe para eliminar.
        strategy="afterInteractive"
        // `onReady` (e não `onLoad`) porque ele também dispara quando o script
        // já estava carregado — o que importa se este componente remontar.
        onReady={marcarAclibPronto}
      />
    </>
  );
}
