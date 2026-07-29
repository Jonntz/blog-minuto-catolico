import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Junta classes resolvendo conflitos do Tailwind (a última vence de verdade).
 * Sem o twMerge, `cn("p-2", "p-4")` deixaria as duas no DOM e a vencedora
 * dependeria da ordem no CSS gerado, não da ordem da chamada.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
