import { PUBLICIDADE_ATIVA } from "@/lib/institucional";
import { cn } from "@/lib/utils";
import { AtivarZona } from "./ad-zone";
import { FORMATOS, type FormatoAnuncio } from "./zonas";

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
 * É por isso que o espaço é reservado **independentemente do consentimento**, e
 * não só para quem aceitou. A alternativa — mostrar o bloco só após o opt-in —
 * pareceria mais elegante e seria pior: quem já aceitou numa visita anterior
 * veria o bloco aparecer alguns milissegundos depois da hidratação, longe de
 * qualquer clique, e isso conta inteiro no CLS.
 *
 * Consequência aceita: quando não há anúncio para exibir — leitor recusou, zona
 * ainda em aprovação, rede sem preenchimento — sobra um espaço vazio. É o preço
 * de não empurrar conteúdo, e é por isso que o slot é discreto e rotulado, em
 * vez de invisível. Com `PUBLICIDADE_ATIVA` em `false` o slot some por completo.
 *
 * ## Por que "Publicidade" escrito
 *
 * Separar conteúdo editorial de publicidade é exigência de honestidade
 * editorial antes de ser de rede de anúncio — e num portal religioso, que o
 * leitor confia, mais ainda. `aria-label` no contêiner para quem navega por
 * leitor de tela saber que pode pular.
 */
export function AdSlot({
  formato,
  id,
  className,
}: {
  formato: FormatoAnuncio;
  /** Alvo do `runBanner`. Precisa ser único na página. */
  id: string;
  className?: string;
}) {
  if (!PUBLICIDADE_ATIVA) return null;

  const { altura, largura, classesDeExibicao } = FORMATOS[formato];

  return (
    <aside
      aria-label="Publicidade"
      className={cn(
        "mx-auto w-full flex-col items-center gap-1.5",
        largura,
        // Depois da largura: em `cn`, a última classe conflitante vence, e é
        // aqui que se decide se o slot existe neste breakpoint.
        classesDeExibicao,
        className,
      )}
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
          altura,
        )}
      />
      <AtivarZona formato={formato} blockId={id} />
    </aside>
  );
}
