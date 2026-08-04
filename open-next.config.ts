import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import { purgeCache } from "@opennextjs/cloudflare/overrides/cache-purge/index";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";
import d1TagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";

/**
 * Adapter OpenNext → Cloudflare Workers.
 *
 * ---------------------------------------------------------------------------
 * O PROBLEMA QUE ESTE ARQUIVO PASSOU A RESOLVER
 * ---------------------------------------------------------------------------
 * Até 03/08/2026 aqui havia `defineCloudflareConfig()` — sem argumento nenhum,
 * rodando nos padrões: cache incremental em assets estáticos e fila em memória.
 *
 * Sob `cacheComponents: true` isso tem uma consequência que não é óbvia e que
 * não aparece em teste local: **não existe store durável para `"use cache"`**.
 * Os quatro perfis caprichados de `cacheLife` do `next.config.ts` e todos os
 * `revalidateTag()` de `src/lib/revalidate.ts` só valiam dentro do isolate
 * vivo. Cada isolate frio do Worker refazia TODAS as consultas no D1, e o
 * `revalidate.ts` — que está impecavelmente escrito e documentado — era, na
 * prática, quase inerte.
 *
 * ---------------------------------------------------------------------------
 * POR QUE KV E D1, E NÃO R2
 * ---------------------------------------------------------------------------
 * O caminho mais direto seria `r2IncrementalCache`. O binding R2 foi removido
 * do `wrangler.jsonc` (ver o comentário longo lá) porque ativar o R2 exige
 * cadastrar método de pagamento, mesmo no tier gratuito — e o projeto é de
 * custo zero.
 *
 * **KV e D1 não têm essa exigência.** É a mesma capacidade pela porta que já
 * está aberta. O trade-off honesto: o KV é eventualmente consistente (uma
 * escrita pode levar até ~60s para propagar globalmente), enquanto o R2 é
 * fortemente consistente. Para um portal de notícias isso é irrelevante — a
 * matéria já espera minutos na fila de adaptação antes de existir.
 */
export default defineCloudflareConfig({
  /**
   * KV embrulhado na Cache API regional.
   *
   * O `withRegionalCache` é o que de fato compensa o isolate frio: ele guarda a
   * entrada na Cache API do datacenter, então a segunda requisição na mesma
   * região nem chega ao KV. `long-lived` porque as páginas deste portal mudam
   * por invalidação de tag (publicação de matéria), não por relógio.
   */
  incrementalCache: withRegionalCache(kvIncrementalCache, {
    mode: "long-lived",
  }),

  /**
   * Tag cache em D1, num banco SEPARADO do `minuto-eclesiastico`.
   *
   * A separação é deliberada e tem dois motivos:
   *  1. Apontar para o banco da aplicação reintroduziria o "segundo binding
   *     para o mesmo banco" que o `wrangler.jsonc` removeu de propósito.
   *  2. O adapter cria e gerencia a própria tabela de revalidações. Ela ficaria
   *     no mesmo schema que o Drizzle controla, e um `drizzle-kit push`
   *     distraído poderia derrubá-la.
   *
   * Bônus: evita contenção de escrita com a ingestão — que, segundo o
   * comentário de `experimental.cpus` no `next.config.ts`, já é sensível a isso.
   */
  tagCache: d1TagCache,

  /**
   * Purga da borda junto com a invalidação de tag.
   *
   * Sem isto, `revalidateTag()` limparia o cache do Next mas a resposta velha
   * continuaria no CDN até o TTL expirar — ou seja, a matéria corrigida ficaria
   * presa. É a peça que torna seguro cachear HTML na borda por Cache Rules.
   *
   * `direct` (e não `durableObject`) porque o volume de publicação é baixo:
   * poucas dezenas de invalidações por dia não justificam um Durable Object.
   */
  cachePurge: purgeCache({ type: "direct" }),

  /**
   * `enableCacheInterception` fica no padrão (`false`) DE PROPÓSITO.
   *
   * A documentação do próprio adapter diz que deve ser `false` quando há PPR —
   * e este projeto usa PPR em praticamente toda página (ver os `<Suspense>` de
   * `src/app/(site)/page.tsx`). Ligar aqui quebraria o streaming.
   */
});
