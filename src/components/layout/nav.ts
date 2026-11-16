import { CATEGORIAS } from "@/lib/categories";
import { ROTA_ARQUIVO, ROTA_LITURGIA, ROTA_SALVOS } from "@/lib/seo";
import type { ItemDeNavegacao } from "./mobile-menu";

/**
 * Categorias sem cobertura nas fontes atuais (MEMORY.md §3 e §5b).
 *
 * Tornar a navegação do cabeçalho e do rodapé estática elimina 3 fronteiras de
 * `<Suspense>` (`NavPrincipal`, `MenuDeCelular` e `ListaDeEditorias`) e 3 chunks
 * de streaming RSC em TODAS as páginas do site, zerando o salto de layout no
 * rodapé e reduzindo o trabalho de hidratação no cliente.
 */
const CATEGORIAS_SEM_COBERTURA = new Set<string>(["brasil"]);

/**
 * Itens da navegação principal.
 */
export function itensDaNavegacao(): readonly ItemDeNavegacao[] {
  return CATEGORIAS.filter(
    (c) => c.naNav && !CATEGORIAS_SEM_COBERTURA.has(c.slug),
  ).map((c) => ({ href: `/categoria/${c.slug}`, label: c.label }));
}

/**
 * Itens do menu de celular: as editorias mais o arquivo completo.
 */
export function itensDoMenuDeCelular(): readonly ItemDeNavegacao[] {
  return [
    ...itensDaNavegacao(),
    { href: ROTA_LITURGIA, label: "Liturgia de 1962" },
    { href: ROTA_ARQUIVO, label: "Todas as notícias" },
    { href: ROTA_SALVOS, label: "Matérias salvas" },
  ];
}

/** Categorias do rodapé: todas as que têm cobertura, na ordem do contrato. */
export function itensDoRodape(): readonly ItemDeNavegacao[] {
  return CATEGORIAS.filter((c) => !CATEGORIAS_SEM_COBERTURA.has(c.slug)).map(
    (c) => ({
      href: `/categoria/${c.slug}`,
      label: c.label,
    }),
  );
}
