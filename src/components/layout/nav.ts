import { connection } from "next/server";
import { categoriasComConteudo } from "@/lib/articles";
import { CATEGORIAS } from "@/lib/categories";
import { ROTA_ARQUIVO } from "@/lib/seo";
import type { ItemDeNavegacao } from "./mobile-menu";

/**
 * `connection()` antes de tocar o D1 — o mesmo que `sitemap.ts`, `robots.ts`,
 * `feed.xml` e o painel litúrgico já fazem.
 *
 * Sem ele, o Next resolve estas leituras em tempo de BUILD para pré-renderizar
 * o conteúdo cacheado. `<Suspense>` não impede isso: ele protege contra dado
 * *dinâmico*, não contra dado *cacheado*. Duas consequências, ambas medidas:
 *
 *   1. O build passa a exigir um D1 migrado. No CI da Cloudflare o
 *      `.wrangler/state` nasce vazio e o build morria com
 *      `D1_ERROR: no such table: articles`.
 *   2. Pior: o que fosse pré-renderizado viria do banco LOCAL, que não é o de
 *      produção. A casca do site nasceria com a navegação de outro banco.
 *
 * O `"use cache"` do data layer continua valendo — `connection()` só diz "não
 * resolva isto no build", não "não cacheie em runtime".
 */
async function apenasEmRequisicao(): Promise<void> {
  await connection();
}

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
  await apenasEmRequisicao();
  const comConteudo = new Set(await categoriasComConteudo());
  return CATEGORIAS.filter((c) => c.naNav && comConteudo.has(c.slug)).map(
    (c) => ({ href: `/categoria/${c.slug}`, label: c.label }),
  );
}

/**
 * Itens do menu de celular: as editorias mais o arquivo completo.
 *
 * O arquivo entra aqui e NÃO na navegação de desktop de propósito. No desktop a
 * barra é uma linha só de 54px, e o design a reserva para as editorias; no
 * celular o menu é uma lista vertical, onde cabe sem disputar espaço com nada.
 * No desktop o caminho para o arquivo são o link do cabeçalho de "Últimas
 * notícias" e o botão ao fim da capa.
 */
export async function itensDoMenuDeCelular(): Promise<
  readonly ItemDeNavegacao[]
> {
  return [
    ...(await itensDaNavegacao()),
    { href: ROTA_ARQUIVO, label: "Todas as notícias" },
  ];
}

/** Categorias do rodapé: todas as que têm conteúdo, na ordem do contrato. */
export async function itensDoRodape(): Promise<readonly ItemDeNavegacao[]> {
  await apenasEmRequisicao();
  const comConteudo = new Set(await categoriasComConteudo());
  return CATEGORIAS.filter((c) => comConteudo.has(c.slug)).map((c) => ({
    href: `/categoria/${c.slug}`,
    label: c.label,
  }));
}
