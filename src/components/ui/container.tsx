import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ContainerProps<T extends ElementType = "div"> = {
  as?: T;
  className?: string;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "className" | "children">;

/**
 * A medida do design: 1240px de conteúdo, 16px de respiro no celular e 40px a
 * partir de `sm`. Está num componente porque a largura aparece no header, no
 * masthead, em cada seção e no rodapé — e todos precisam alinhar na mesma
 * coluna, senão o header "dança" em relação ao conteúdo.
 *
 * Repassa `...rest` (`aria-labelledby`, `aria-hidden`, `id`, etc.) para o
 * elemento subjacente — sem isto, toda `<Container as="section" aria-labelledby="...">`
 * perdia o rótulo acessível em runtime.
 */
export function Container<T extends ElementType = "div">({
  as,
  className,
  children,
  ...rest
}: ContainerProps<T>) {
  const Tag: ElementType = as ?? "div";
  return (
    <Tag
      {...rest}
      className={cn("mx-auto w-full max-w-[1240px] px-4 sm:px-10", className)}
    >
      {children}
    </Tag>
  );
}
