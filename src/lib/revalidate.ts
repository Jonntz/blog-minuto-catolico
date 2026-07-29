import { revalidateTag } from "next/cache";
import { TAGS } from "@/lib/articles";

/**
 * Invalidação de cache após publicar.
 *
 * Sob Cache Components, inserir no D1 **não** faz o site mudar: as leituras
 * estão sob `"use cache"` e só saem do cache por tag. Quem promove um artigo
 * para `published` precisa chamar isto, senão a matéria fica no banco e nunca
 * aparece — o modo de falha mais confuso possível, porque o dado "está lá".
 *
 * ⚠️ No Next 16 `revalidateTag` exige DOIS argumentos: a tag e o perfil de
 * `cacheLife` a que ela pertence (assinatura
 * `revalidateTag(tag, profile: string | CacheLifeConfig)`). O perfil informado
 * aqui precisa bater com o declarado na função de leitura correspondente em
 * `src/lib/articles.ts` — passar o perfil errado invalida com a janela errada.
 *
 * `revalidateTag` marca como stale e regenera na próxima leitura. Use
 * `updateTag` (que segue recebendo só a tag) quando a própria Server Action
 * precisar refletir o dado na MESMA requisição — CLAUDE.md §4.
 */

/** Perfis declarados em `next.config.ts`, espelhando `src/lib/articles.ts`. */
const PERFIL = {
  feedHome: "homeFeed",
  categoria: "category",
  artigo: "article",
  liturgia: "liturgy",
} as const;

export function invalidarAposPublicar(
  publicados: readonly { slug: string; categorySlug: string }[],
): void {
  if (publicados.length === 0) return;

  revalidateTag(TAGS.feedHome, PERFIL.feedHome);
  revalidateTag(TAGS.categoriasComConteudo, PERFIL.categoria);

  const categorias = new Set(publicados.map((a) => a.categorySlug));
  for (const categoria of categorias) {
    revalidateTag(TAGS.categoria(categoria), PERFIL.categoria);
  }
  for (const artigo of publicados) {
    revalidateTag(TAGS.artigo(artigo.slug), PERFIL.artigo);
  }
}

/** Invalidação após recarregar o calendário litúrgico. */
export function invalidarLiturgia(datas: readonly string[]): void {
  for (const data of datas) {
    revalidateTag(TAGS.liturgia(data), PERFIL.liturgia);
  }
  // A capa mostra a liturgia do dia no painel lateral.
  revalidateTag(TAGS.feedHome, PERFIL.feedHome);
}
