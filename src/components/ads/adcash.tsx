"use client";

import Script from "next/script";
import { useConsentimento } from "@/components/consent/consent-store";
import { PUBLICIDADE_ATIVA } from "@/lib/institucional";

/**
 * Carregador da Adcash — só entra depois do opt-in.
 *
 * ## O que este arquivo NÃO faz, e por quê
 *
 * **Não usa `runAutoTag`.** A versão anterior, direto no `<head>` do root
 * layout, chamava `aclib.runAutoTag` em duas zonas. Esse é o pacote 4-em-1 da
 * Adcash: pop-under, intersticial, in-page push e video slider, com
 * anti-adblock. Pop-under e intersticial estão na lista de menos preferidos do
 * Coalition for Better Ads, e intersticial intrusivo é fator de rebaixamento no
 * Google mobile — ou seja, aquele formato competia diretamente com a meta nº 1
 * do CLAUDE.md §1 ("indexação perfeita no Google News", "CLS < 0.1"). Aqui só
 * há `runBanner`, em slot com altura reservada.
 *
 * **Não emite `<script>` inline.** A chamada de inicialização vai no callback
 * `onReady` do `next/script`. Isso resolve duas coisas de uma vez: elimina a
 * corrida em que o inline executava antes de `aclib` existir (`ReferenceError`
 * no console de todo visitante), e tira mais um `<script>` inline do stream
 * RSC — o MEMORY.md §5c registra que foi exatamente essa classe de construção
 * que derrubou o site inteiro em 31/07.
 *
 * **Não faz preconnect no layout.** O `<link rel="preconnect">` para
 * `acscdn.com` é renderizado AQUI, dentro do ramo com consentimento. Preconnect
 * incondicional no `<head>` abriria conexão com a rede de anúncio antes do
 * opt-in, entregando o IP do visitante — o que anularia metade do sentido do
 * banner.
 */

/**
 * Recorte tipado da API global do aclib.
 *
 * Declarado à mão porque a Adcash não publica tipos, e `any` é proibido
 * (CLAUDE.md §8). Só o que de fato usamos entra aqui.
 */
interface Aclib {
  runBanner(opcoes: { zoneId: string; blockId?: string }): void;
}

declare global {
  interface Window {
    aclib?: Aclib;
  }
}

const SRC_ACLIB = "https://acscdn.com/script/aclib.js";

export interface ZonaAnuncio {
  /** Id da zona no painel da Adcash. */
  zoneId: string;
  /** `id` do elemento onde o criativo é injetado — bate com o `id` do `AdSlot`. */
  blockId: string;
}

export function Adcash({ zonas }: { zonas: readonly ZonaAnuncio[] }) {
  const estado = useConsentimento();

  // Três portas em série, e todas precisam estar abertas:
  // o interruptor global da política, o opt-in do leitor, e haver zona.
  if (!PUBLICIDADE_ATIVA) return null;
  if (estado !== "aceito") return null;
  if (zonas.length === 0) return null;

  return (
    <>
      {/* Só agora — nunca antes do aceite. */}
      <link rel="preconnect" href="https://acscdn.com" crossOrigin="anonymous" />
      <Script
        id="aclib"
        src={SRC_ACLIB}
        // `afterInteractive`: depois da hidratação, fora do caminho crítico do
        // LCP. `beforeInteractive` recolocaria o bloqueio de render que este
        // arquivo existe para eliminar.
        strategy="afterInteractive"
        onReady={() => {
          // `onReady` (e não `onLoad`) porque ele também dispara quando o
          // script já estava carregado de uma navegação anterior — sem isso,
          // trocar de página deixaria o slot vazio.
          const aclib = window.aclib;
          if (!aclib) return;

          for (const zona of zonas) {
            try {
              aclib.runBanner({ zoneId: zona.zoneId, blockId: zona.blockId });
            } catch (erro) {
              // Falha de uma zona não pode derrubar a hidratação da página.
              console.warn(
                JSON.stringify({
                  escopo: "ads.adcash",
                  evento: "run_banner_falhou",
                  zoneId: zona.zoneId,
                  erro: erro instanceof Error ? erro.message : String(erro),
                }),
              );
            }
          }
        }}
      />
    </>
  );
}
