import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Paginação do acervo.
 *
 * É Server Component e usa `<Link>` — não `useState`. O estado da listagem mora
 * na URL, e isso não é detalhe de implementação: paginação em estado de cliente
 * não pode ser compartilhada, não volta com o botão "voltar", não é rastreável
 * pelo Google e obriga a mandar o acervo inteiro para o navegador. Todos os
 * quatro problemas somem quando a página é um parâmetro de rota.
 */

/** Quantos números aparecem em volta da página atual. */
const JANELA = 1;

/**
 * Sequência de páginas a exibir, com buracos marcados por `null`.
 *
 * Primeira e última SEMPRE aparecem: são os dois destinos que alguém realmente
 * procura num arquivo ("começo" e "o mais antigo").
 */
export function janelaDePaginas(
  atual: number,
  total: number,
): readonly (number | null)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const numeros = new Set<number>([1, total]);
  for (let p = atual - JANELA; p <= atual + JANELA; p++) {
    if (p >= 1 && p <= total) numeros.add(p);
  }

  const ordenados = [...numeros].sort((a, b) => a - b);
  const saida: (number | null)[] = [];
  let anterior = 0;
  for (const n of ordenados) {
    if (anterior && n - anterior > 1) saida.push(null);
    saida.push(n);
    anterior = n;
  }
  return saida;
}

const BASE_ITEM =
  "inline-flex min-h-10 min-w-10 touch-manipulation items-center justify-center rounded-full border px-3 text-[13px] font-medium transition-colors duration-200 ease-dc";

export function Pagination({
  pagina,
  totalDePaginas,
  /** Recebe o número e devolve o href — quem chama decide os outros filtros. */
  href,
  className,
}: {
  pagina: number;
  totalDePaginas: number;
  href: (pagina: number) => string;
  className?: string;
}) {
  if (totalDePaginas <= 1) return null;

  const temAnterior = pagina > 1;
  const temProxima = pagina < totalDePaginas;

  return (
    <nav
      aria-label="Paginação"
      className={cn("flex flex-wrap items-center justify-center gap-2", className)}
    >
      {/* Desabilitado vira <span>, não <a> com `pointer-events:none`: link que
          não leva a lugar nenhum continua sendo anunciado como link e recebe
          foco, o que é pior do que não existir. */}
      {temAnterior ? (
        <Link
          href={href(pagina - 1)}
          rel="prev"
          className={cn(
            BASE_ITEM,
            "border-line bg-surface text-ink-2 hover:border-blue-f hover:text-blue-f",
          )}
        >
          <span aria-hidden="true">←</span>
          <span className="ml-1.5">Anterior</span>
        </Link>
      ) : (
        <span aria-hidden="true" className={cn(BASE_ITEM, "border-transparent text-ink-3 opacity-40")}>
          <span>←</span>
          <span className="ml-1.5">Anterior</span>
        </span>
      )}

      <ol className="flex flex-wrap items-center gap-1.5">
        {janelaDePaginas(pagina, totalDePaginas).map((n, i) =>
          n === null ? (
            <li
              key={`gap-${i}`}
              aria-hidden="true"
              className="px-1 text-[13px] text-ink-3"
            >
              …
            </li>
          ) : (
            <li key={n}>
              {n === pagina ? (
                <span
                  aria-current="page"
                  className={cn(BASE_ITEM, "border-transparent bg-ink font-semibold text-bg")}
                >
                  {n}
                </span>
              ) : (
                <Link
                  href={href(n)}
                  aria-label={`Página ${n}`}
                  className={cn(
                    BASE_ITEM,
                    "border-line bg-surface text-ink-2 hover:border-blue-f hover:text-blue-f",
                  )}
                >
                  {n}
                </Link>
              )}
            </li>
          ),
        )}
      </ol>

      {temProxima ? (
        <Link
          href={href(pagina + 1)}
          rel="next"
          className={cn(
            BASE_ITEM,
            "border-line bg-surface text-ink-2 hover:border-blue-f hover:text-blue-f",
          )}
        >
          <span className="mr-1.5">Próxima</span>
          <span aria-hidden="true">→</span>
        </Link>
      ) : (
        <span aria-hidden="true" className={cn(BASE_ITEM, "border-transparent text-ink-3 opacity-40")}>
          <span className="mr-1.5">Próxima</span>
          <span>→</span>
        </span>
      )}
    </nav>
  );
}
