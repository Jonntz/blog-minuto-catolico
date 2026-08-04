import { Adcash, type ZonaAnuncio } from "@/components/ads/adcash";
import { ConsentBanner } from "./consent-banner";

/**
 * Ponto único de montagem do consentimento e da publicidade.
 *
 * Fica em `src/app/(site)/layout.tsx`, e **não** no root layout: o route group
 * `(admin)` previsto no CLAUDE.md §3 não deve herdar anúncio nem banner. Manter
 * isto num componente só significa que ligar ou desligar publicidade no site
 * inteiro é uma linha, num lugar previsível.
 *
 * Este componente é de SERVIDOR de propósito, apesar de os dois filhos serem de
 * cliente: assim a fronteira cliente fica nas folhas e o layout continua
 * prerenderizável.
 *
 * ## As zonas
 *
 * ⚠️ Os `zoneId` abaixo vêm do painel da Adcash e precisam ser de zonas do tipo
 * **banner/display**. As duas zonas antigas (`pcewqvqovo`, `xlwsd0rw7w`) eram
 * AutoTag — formato descartado, ver `src/components/ads/adcash.tsx`. Enquanto a
 * lista estiver vazia, nada é carregado e o `AdSlot` fica com o espaço
 * reservado em branco, sem quebrar layout.
 */
const ZONAS: readonly ZonaAnuncio[] = [
  // Exemplo do formato esperado, a preencher com as zonas reais:
  // { zoneId: "0000000000", blockId: "anuncio-capa" },
];

export function ConsentGate() {
  return (
    <>
      <ConsentBanner />
      <Adcash zonas={ZONAS} />
    </>
  );
}
