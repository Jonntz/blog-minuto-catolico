import { classesTom, getCategoriaOuPadrao } from "@/lib/categories";
import { cn } from "@/lib/utils";

/**
 * A tag de categoria do design: pílula em caixa alta, com o par
 * foreground/background do tom definido em `src/lib/categories.ts`.
 *
 * O rótulo nunca é escrito à mão no JSX — vem sempre do slug, para que
 * renomear "Igreja no Brasil" aconteça num arquivo só.
 */
export function CategoryTag({
  slug,
  className,
}: {
  slug: string;
  className?: string;
}) {
  const categoria = getCategoriaOuPadrao(slug);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-1.5 text-[11px] leading-none font-semibold tracking-[0.08em] uppercase",
        classesTom(categoria.tom),
        className,
      )}
    >
      {categoria.label}
    </span>
  );
}
