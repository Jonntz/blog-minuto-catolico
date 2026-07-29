import type { Article } from "@/db/schema";

/**
 * Bloco de proveniência ao fim da matéria.
 *
 * Não é rodapé decorativo: o CLAUDE.md §6 trata atribuição da fonte como
 * requisito de produto, e o schema guarda `sourceUrl`/`sourceName`/`fetchedAt`
 * exatamente para isto ser exibível. Dizer em voz alta que o texto é adaptado —
 * e não traduzido nem republicado — é o que separa este portal de um agregador
 * que copia.
 *
 * `rel="noopener noreferrer"` no link externo, e `target="_blank"` anunciado no
 * texto acessível para que ninguém seja surpreendido por uma aba nova.
 */
export function SourceNote({ artigo }: { artigo: Article }) {
  return (
    <aside
      aria-labelledby="fonte-original"
      className="mt-12 rounded-[18px] border border-line bg-surface-2 p-6"
    >
      <h2
        id="fonte-original"
        className="text-xs tracking-[0.12em] text-ink-3 uppercase"
      >
        Fonte
      </h2>

      <p className="mt-3 text-[15px] leading-[1.6] text-ink-2">
        Matéria adaptada em português a partir de{" "}
        <span className="font-medium text-ink">{artigo.sourceName}</span>
        {artigo.sourceAuthor ? `, de ${artigo.sourceAuthor}` : ""}. O texto foi
        reescrito, não traduzido na íntegra.
      </p>

      <p className="mt-4">
        <a
          href={artigo.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-[14px] font-medium text-blue-f"
        >
          <span>
            Ler o original: <span className="italic">{artigo.sourceTitle}</span>
          </span>
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
            className="size-4 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M13 5h6v6M19 5l-8.5 8.5M18 14v4a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 18V8a1.5 1.5 0 0 1 1.5-1.5H10" />
          </svg>
          <span className="sr-only">(abre em nova aba)</span>
        </a>
      </p>
    </aside>
  );
}
