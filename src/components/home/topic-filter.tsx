"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ChipDeTema {
  slug: string;
  label: string;
  /** Par foreground/background do tom, vindo de `classesTom()` no servidor. */
  classesAtivo: string;
}

export interface ItemFiltravel {
  id: string;
  categoria: string;
  /** Card JÁ RENDERIZADO no servidor. */
  card: ReactNode;
}

const TODOS = "todos";

/**
 * Régua de chips + grade filtrada.
 *
 * O ponto arquitetural: `card` chega como `ReactNode` já renderizado pelo
 * servidor. O componente cliente decide o que aparece, mas nunca constrói o
 * card — então `ArticleCard`, `next/image` e o módulo de categorias continuam
 * inteiramente do lado do servidor, e o bundle deste arquivo é o `useState` e o
 * `map`. Importar `ArticleCard` daqui arrastaria a árvore toda para o cliente
 * sem ganho nenhum.
 *
 * Filtrar com o atributo `hidden` (e não removendo do array) mantém a marcação
 * completa no HTML: os rastreadores veem todas as chamadas da capa, e alternar
 * chip não recria DOM — só troca a visibilidade.
 */
export function TopicFilter({
  chips,
  itens,
  className,
}: {
  chips: readonly ChipDeTema[];
  itens: readonly ItemFiltravel[];
  className?: string;
}) {
  const [ativo, setAtivo] = useState<string>(TODOS);

  const visiveis =
    ativo === TODOS
      ? itens.length
      : itens.reduce((n, i) => (i.categoria === ativo ? n + 1 : n), 0);

  const rotuloAtivo =
    ativo === TODOS
      ? "todos os temas"
      : (chips.find((c) => c.slug === ativo)?.label ?? ativo);

  return (
    <div className={className}>
      <div
        data-hscroll=""
        role="group"
        aria-label="Filtrar a capa por tema"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-10 sm:px-10"
      >
        {chips.map((chip) => {
          const selecionado = chip.slug === ativo;
          return (
            <button
              key={chip.slug}
              type="button"
              onClick={() => setAtivo(chip.slug)}
              aria-pressed={selecionado}
              className={cn(
                "inline-flex min-h-11 shrink-0 touch-manipulation items-center rounded-full border px-4 text-[13px] font-medium whitespace-nowrap transition-colors duration-200 ease-dc",
                selecionado
                  ? cn("border-transparent font-semibold", chip.classesAtivo)
                  : "border-line bg-surface text-ink-2 hover:border-blue-f hover:text-blue-f",
              )}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* Resultado do filtro anunciado para quem não vê a grade mudar. */}
      <p role="status" aria-live="polite" className="sr-only">
        {visiveis} {visiveis === 1 ? "matéria" : "matérias"} em {rotuloAtivo}.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {itens.map((item) => (
          <div
            key={item.id}
            className="h-full"
            hidden={ativo !== TODOS && item.categoria !== ativo}
          >
            {item.card}
          </div>
        ))}
      </div>
    </div>
  );
}
