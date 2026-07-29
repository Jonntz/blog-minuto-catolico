import { cn } from "@/lib/utils";

/**
 * Campo de busca do design.
 *
 * Server Component, sem uma linha de JavaScript: é um `<form method="get">`
 * apontando para `/busca`. Funciona com JS desligado, e a expansão no foco
 * (124px → 196px no desktop) é só a variante `focus:` do Tailwind, como no
 * original — que fazia isso via `style-focus`.
 */
export function SiteSearch({
  variante = "desktop",
  className,
}: {
  variante?: "desktop" | "mobile";
  className?: string;
}) {
  const desktop = variante === "desktop";

  return (
    <form action="/busca" method="get" role="search" className={className}>
      <input
        type="search"
        name="q"
        placeholder="Buscar"
        aria-label="Buscar notícias"
        className={cn(
          "border border-line bg-surface-2 text-ink outline-none",
          "transition-[width,border-color] duration-[400ms] ease-dc",
          "placeholder:text-ink-3 focus:border-ink-3",
          desktop
            ? "w-[124px] rounded-full px-3 py-[7px] text-[13px] focus:w-[196px]"
            : "min-h-[46px] w-full min-w-0 rounded-xl px-3.5 py-3 text-[15px]",
        )}
      />
    </form>
  );
}
