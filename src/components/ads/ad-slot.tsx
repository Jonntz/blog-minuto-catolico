import { cn } from "@/lib/utils";

/**
 * Espaço reservado para um anúncio.
 *
 * ## A regra que não pode ser afrouxada
 *
 * A altura é reservada **antes** de o anúncio existir, e não muda quando ele
 * chega. Slot sem altura fixa é a causa número um de CLS em portal com
 * publicidade: o criativo carrega depois do texto, empurra tudo para baixo, e o
 * leitor clica no lugar errado. O CLAUDE.md §1 fixa CLS < 0.1, e o resto do
 * projeto já paga esse cuidado em `ArticleMedia` (que reserva proporção) e no
 * `LiturgyPanelSkeleton` (que reserva a silhueta dos cartões).
 *
 * Consequência aceita: quando não há anúncio para exibir — leitor recusou,
 * rede sem preenchimento — sobra um espaço vazio. É o preço de não empurrar
 * conteúdo, e é por isso que o slot é discreto e rotulado, em vez de invisível.
 *
 * ## Por que "Publicidade" escrito
 *
 * Separar conteúdo editorial de publicidade é exigência de honestidade
 * editorial antes de ser de rede de anúncio — e num portal religioso, que o
 * leitor confia, mais ainda. `aria-label` no contêiner para quem navega por
 * leitor de tela saber que pode pular.
 */

/** Formatos disponíveis. A altura de cada um é contrato com o CLS. */
export type FormatoAnuncio = "retangulo" | "faixa";

const ALTURA: Readonly<Record<FormatoAnuncio, string>> = {
  /** 300×250 medium rectangle — o padrão de coluna lateral e meio de matéria. */
  retangulo: "min-h-[250px]",
  /** 320×100 no celular, 728×90 a partir de `sm`. Faixa entre seções. */
  faixa: "min-h-[100px] sm:min-h-[90px]",
};

export function AdSlot({
  formato,
  id,
  className,
}: {
  formato: FormatoAnuncio;
  /** Alvo do `runBanner` da Adcash. Precisa ser único na página. */
  id: string;
  className?: string;
}) {
  return (
    <aside
      aria-label="Publicidade"
      className={cn("flex flex-col items-center gap-1.5", className)}
    >
      <span
        aria-hidden="true"
        className="text-[10px] tracking-[0.12em] text-ink-3 uppercase"
      >
        Publicidade
      </span>
      <div
        id={id}
        className={cn(
          "flex w-full items-center justify-center overflow-hidden rounded-[14px] bg-surface-2",
          ALTURA[formato],
        )}
      />
    </aside>
  );
}
