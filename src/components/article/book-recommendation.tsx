import {
  escolherObraPorCategoria,
  TAG_AFILIADO_AMAZON,
  urlBuscaAmazon,
} from "@/lib/recomendacoes";

/**
 * Recomendação contextual de leitura espiritual/litúrgica.
 *
 * Server Component puro (zero JavaScript no cliente, zero cookies, CLS = 0).
 * Usa `rel="sponsored noopener noreferrer"` quando há tag de afiliado ativa,
 * conforme diretrizes do Google Search Essentials.
 */
export function BookRecommendation({
  categoriaSlug,
}: {
  categoriaSlug: string;
}) {
  const obra = escolherObraPorCategoria(categoriaSlug);
  const url = urlBuscaAmazon(obra);

  return (
    <aside
      aria-labelledby="leitura-recomendada"
      className="mt-8 rounded-[18px] border border-line bg-surface p-6 shadow-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="leitura-recomendada"
          className="text-xs tracking-[0.12em] text-ink-3 uppercase"
        >
          Leitura recomendada para aprofundar
        </h2>
        {TAG_AFILIADO_AMAZON ? (
          <span className="text-[11px] text-ink-3">
            Como Associado da Amazon, ganhamos com compras qualificadas
          </span>
        ) : null}
      </div>

      <p className="mt-3 font-display text-[18px] leading-[1.2] font-semibold tracking-[-0.02em] text-ink">
        {obra.titulo}
      </p>
      <p className="mt-1 text-xs font-medium text-ink-3">{obra.autor}</p>

      <p className="mt-2.5 text-[14.5px] leading-[1.55] text-ink-2">
        {obra.motivo}
      </p>

      <p className="mt-4">
        <a
          href={url}
          target="_blank"
          rel={
            TAG_AFILIADO_AMAZON
              ? "sponsored noopener noreferrer"
              : "noopener noreferrer"
          }
          className="inline-flex min-h-10 touch-manipulation items-center gap-1.5 rounded-full border border-line bg-surface-2 px-4 text-xs font-medium text-ink transition-colors duration-200 ease-dc hover:border-blue-f hover:text-blue-f"
        >
          <span>Conferir edição em português</span>
          <span aria-hidden="true">→</span>
          <span className="sr-only">(abre em nova aba)</span>
        </a>
      </p>
    </aside>
  );
}
