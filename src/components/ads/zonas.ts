/**
 * As zonas da Adcash e o contrato de tamanho de cada uma.
 *
 * ## Por que zoneId, altura e breakpoint moram no MESMO objeto
 *
 * São três coisas que precisam concordar e que, separadas, divergem no commit
 * seguinte: a zona `11907658` serve criativo 300×250, o slot reserva 250px de
 * altura, e o criativo tem de caber na largura disponível. Se alguém trocar o
 * `zoneId` de um slot por uma zona de outro tamanho, o criativo estoura ou
 * sobra espaço — e nenhum teste pega isso. Amarrados aqui, a única forma de
 * errar é editar esta tabela.
 *
 * ## Por que a faixa é só de `md` para cima
 *
 * 728px não cabe num viewport de 360px. O `AdSlot` tem `overflow-hidden`, então
 * o resultado não seria layout quebrado — seria pior: um criativo cortado, que
 * a rede contabiliza como impressão e o leitor não consegue ler. `mediaQuery`
 * existe para o JavaScript reproduzir EXATAMENTE o que `classesDeExibicao` faz
 * no CSS: sem ela, o `runBanner` rodaria dentro de um contêiner `display:none`
 * e geraria impressão não visível, que é o que rede de anúncio chama de tráfego
 * inválido.
 *
 * ## ⚠️ Zonas que NÃO entram aqui
 *
 * O painel tem também uma zona AutoTag (`si5mdwejfc`) e uma Pop-Under
 * (`11907602`), criadas antes de as zonas de display aparecerem. Nenhuma das
 * duas é usada, e nenhuma das duas deve ser: AutoTag é o pacote 4-em-1 que já
 * foi removido do `layout.tsx` (ver `adcash.tsx`), e ele **já contém** pop-under
 * — rodar as duas juntas serviria dois pop-unders por sessão, sem capping
 * compartilhado. O motivo completo da recusa está em `adcash.tsx`.
 */

export type FormatoAnuncio = "retangulo" | "faixa";

export interface Formato {
  /** Id da zona no painel da Adcash. */
  readonly zoneId: string;
  /** Tamanho do criativo, para quem for conferir contra o painel. */
  readonly tamanho: string;
  /** Altura reservada ANTES de o criativo chegar. É o contrato com o CLS. */
  readonly altura: string;
  /** Largura máxima do slot — o criativo não deve nadar num bloco largo. */
  readonly largura: string;
  /** Em que breakpoints o slot existe. */
  readonly classesDeExibicao: string;
  /** A mesma regra acima, para o JS. `null` = visível em qualquer largura. */
  readonly mediaQuery: string | null;
}

export const FORMATOS: Readonly<Record<FormatoAnuncio, Formato>> = {
  retangulo: {
    zoneId: "11907658",
    tamanho: "300×250",
    altura: "min-h-[250px]",
    largura: "max-w-[300px]",
    // 300px cabe no menor viewport que este site atende.
    classesDeExibicao: "flex",
    mediaQuery: null,
  },
  faixa: {
    zoneId: "11907650",
    tamanho: "728×90",
    altura: "min-h-[90px]",
    largura: "max-w-[728px]",
    classesDeExibicao: "hidden md:flex",
    mediaQuery: "(min-width: 768px)",
  },
} as const;
