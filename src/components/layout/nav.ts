import { categoriasComConteudo } from "@/lib/articles";
import { CATEGORIAS } from "@/lib/categories";
import type { ItemDeNavegacao } from "./mobile-menu";

/**
 * Itens da navegação principal.
 *
 * A regra decisiva está no filtro por conteúdo: "Igreja no Brasil" está
 * marcada `naNav: true` em `categories.ts`, mas hoje nenhuma das duas fontes
 * cobre o Brasil (MEMORY.md §3). Deixar o item no menu levaria o leitor a uma
 * página vazia — pior do que não ter o item. Quando a categoria receber o
 * primeiro artigo, ela aparece sozinha, sem mudança de código.
 */
export async function itensDaNavegacao(): Promise<readonly ItemDeNavegacao[]> {
  const comConteudo = new Set(await categoriasComConteudo());
  return CATEGORIAS.filter((c) => c.naNav && comConteudo.has(c.slug)).map(
    (c) => ({ href: `/categoria/${c.slug}`, label: c.label }),
  );
}

/** Categorias do rodapé: todas as que têm conteúdo, na ordem do contrato. */
export async function itensDoRodape(): Promise<readonly ItemDeNavegacao[]> {
  const comConteudo = new Set(await categoriasComConteudo());
  return CATEGORIAS.filter((c) => comConteudo.has(c.slug)).map((c) => ({
    href: `/categoria/${c.slug}`,
    label: c.label,
  }));
}
