import Link from "next/link";
import type { Article } from "@/db/schema";
import { rotaArtigo } from "@/lib/seo";
import { tituloArtigo } from "@/lib/seo";

/**
 * Bloco numerado da barra lateral — a lista de 4 itens do design.
 *
 * ## Sobre o rótulo
 *
 * O design escreve "Mais lidas da semana". **Não temos contagem de leitura** —
 * não há analytics, e sob Cache Components a página de artigo é servida do
 * cache, então nem um contador ingênuo funcionaria sem infraestrutura própria.
 *
 * Chamar de "mais lidas" uma lista ordenada por data seria mentir para o leitor
 * sobre um dado que ele usa para decidir o que ler. Então o rótulo diz o que a
 * lista realmente é. Quando houver contagem real, trocar o rótulo e a consulta
 * — a marcação não muda.
 */
export function WeeklyHighlights({ artigos }: { artigos: readonly Article[] }) {
  if (artigos.length === 0) return null;

  return (
    <div className="rounded-[18px] border border-line p-[22px]">
      <p className="mb-3.5 text-[10.5px] font-semibold tracking-[0.1em] text-ink-3 uppercase">
        Destaques da semana
      </p>

      <ol className="flex list-none flex-col gap-3.5 p-0">
        {artigos.map((artigo, indice) => (
          <li
            key={artigo.slug}
            className="flex items-start gap-3 border-b border-line pb-3.5 last:border-b-0 last:pb-0"
          >
            <span
              aria-hidden="true"
              className="min-w-4 font-display text-[15px] font-semibold text-ink-3"
            >
              {indice + 1}
            </span>
            <Link
              href={rotaArtigo(artigo.slug)}
              className="text-[14.5px] leading-[1.35] font-medium transition-colors duration-200 hover:text-blue-f"
            >
              {tituloArtigo(artigo)}
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
