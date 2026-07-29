import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A medida do design: 1240px de conteúdo, 16px de respiro no celular e 40px a
 * partir de `sm`. Está num componente porque a largura aparece no header, no
 * masthead, em cada seção e no rodapé — e todos precisam alinhar na mesma
 * coluna, senão o header "dança" em relação ao conteúdo.
 */
export function Container({
  as: Tag = "div",
  className,
  children,
}: {
  as?: ElementType;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag className={cn("mx-auto w-full max-w-[1240px] px-4 sm:px-10", className)}>
      {children}
    </Tag>
  );
}
