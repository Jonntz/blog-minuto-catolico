import Link from "next/link";
import { CATEGORIAS, classesTom } from "@/lib/categories";
import { cn } from "@/lib/utils";

/**
 * Régua de editorias do arquivo, em links.
 *
 * Mesma aparência dos chips da capa (`TopicFilter`), mas propósito oposto: lá o
 * filtro é de cliente, sobre uma lista já enviada; aqui ele muda a CONSULTA.
 * Por isso são `<Link>` e não `<button>` — o resultado precisa ser endereçável,
 * voltar com o botão do navegador e ser rastreável.
 *
 * `presentes` vem do banco: editoria sem matéria publicada não vira chip. É a
 * mesma regra da navegação principal — filtro que só devolve zero é armadilha.
 */
export function CategoryLinks({
  presentes,
  ativa,
  href,
  className,
}: {
  presentes: ReadonlySet<string>;
  /** Slug ativo, ou `undefined` para "Todas". */
  ativa?: string;
  /** Recebe o slug (ou `undefined` para "Todas") e devolve o href. */
  href: (slug?: string) => string;
  className?: string;
}) {
  const disponiveis = CATEGORIAS.filter((c) => presentes.has(c.slug));
  if (disponiveis.length === 0) return null;

  const itens = [
    { slug: undefined, label: "Todas", classesAtivo: "bg-ink text-bg" },
    ...disponiveis.map((c) => ({
      slug: c.slug as string | undefined,
      label: c.label,
      classesAtivo: classesTom(c.tom),
    })),
  ];

  return (
    <nav
      data-hscroll=""
      aria-label="Filtrar por editoria"
      className={cn(
        "-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-10 sm:px-10",
        className,
      )}
    >
      {itens.map((item) => {
        const selecionado = item.slug === ativa;
        return (
          <Link
            key={item.slug ?? "todas"}
            href={href(item.slug)}
            aria-current={selecionado ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 shrink-0 touch-manipulation items-center rounded-full border px-4 text-[13px] font-medium whitespace-nowrap transition-colors duration-200 ease-dc",
              selecionado
                ? cn("border-transparent font-semibold", item.classesAtivo)
                : "border-line bg-surface text-ink-2 hover:border-blue-f hover:text-blue-f",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
