import { Adcash } from "@/components/ads/adcash";
import { ConsentBanner } from "./consent-banner";

/**
 * Ponto único de montagem do consentimento e do carregador de publicidade.
 *
 * Fica em `src/app/(site)/layout.tsx`, e **não** no root layout: o route group
 * `(admin)` previsto no CLAUDE.md §3 não deve herdar anúncio nem banner.
 *
 * Este componente é de SERVIDOR de propósito, apesar de os dois filhos serem de
 * cliente: assim a fronteira cliente fica nas folhas e o layout continua
 * prerenderizável.
 *
 * As zonas **não** são listadas aqui. Cada `AdSlot` conhece a própria zona
 * (`src/components/ads/zonas.ts`) e a ativa quando monta — ver a explicação em
 * `src/components/ads/aclib.ts`. Uma lista central aqui obrigaria este layout,
 * que nunca desmonta, a saber quais slots existem em cada página.
 */
export function ConsentGate() {
  return (
    <>
      <ConsentBanner />
      <Adcash />
    </>
  );
}
