import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  /**
   * Cache Components (estável no Next 16).
   *
   * Torna TUDO dinâmico por padrão — o cache passa a ser explícito via a diretiva
   * `"use cache"` + `cacheLife()`, combinado com Partial Prerendering para servir o
   * shell estático na hora e streamar o conteúdo dinâmico.
   *
   * Consequência prática: o antigo `revalidate` numérico em `fetch` está obsoleto
   * sob este modelo. Invalidação é sempre por tag — `revalidateTag()` para marcar
   * como stale, `updateTag()` quando a própria rota de ingestão precisa refletir o
   * dado na mesma requisição. Não misturar os dois modelos.
   */
  cacheComponents: true,

  /**
   * Perfis de cache por tipo de conteúdo (CLAUDE.md §4).
   * Portal de notícias: a capa precisa ser fresca, o artigo antigo não.
   */
  cacheLife: {
    // Home — é o que mais sofre com conteúdo velho.
    homeFeed: { stale: 60, revalidate: 300, expire: 900 },
    // Listagem por categoria — menos crítica que a capa.
    category: { stale: 120, revalidate: 600, expire: 1800 },
    // Artigo — depois de publicado quase nunca muda.
    article: { stale: 300, revalidate: 3600, expire: 86400 },
    // Liturgia — vira uma vez por dia, e o ano inteiro já está no D1.
    liturgy: { stale: 3600, revalidate: 43200, expire: 172800 },
  },

  images: {
    // Hosts das fontes. EWTN serve via Cloudinary; o Sign of the Cross serve o
    // og:image do próprio WordPress. Host novo precisa entrar aqui, senão o
    // next/image recusa em runtime.
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "www.ewtnnews.com" },
      { protocol: "https", hostname: "www.signofthecrossmedia.com" },
      { protocol: "https", hostname: "salvemaria.com.br" },
    ],
    formats: ["image/avif", "image/webp"],
  },

  typescript: {
    // O build deve quebrar em erro de tipo. Nunca ligar ignoreBuildErrors.
    ignoreBuildErrors: false,
  },

  experimental: {
    /**
     * Um único worker de build.
     *
     * O D1 local é um SQLite servido pelo Miniflare, e ele não aguenta os 7
     * workers padrão do Next batendo ao mesmo tempo durante a geração de
     * páginas — a query morre com "Failed to parse body as JSON, got: Error:
     * internal error", que parece erro de query mas é contenção.
     *
     * Custa alguns segundos de build e evita uma falha intermitente que só
     * aparece quando há dados no banco.
     */
    cpus: 1,
  },
};

export default nextConfig;

/**
 * Expõe os bindings do Cloudflare (D1, R2, AI) durante `next dev`.
 * Sem isto, `getCloudflareContext()` devolve undefined em desenvolvimento.
 *
 * Duas ressalvas descobertas na prática:
 *
 * 1. Só pode rodar em dev. O next.config.ts é avaliado também no `next build`,
 *    e lá esta chamada abre uma sessão de proxy que quebra o build.
 *
 * 2. `remoteBindings` tem default `true`, o que exige CLOUDFLARE_API_TOKEN e
 *    conexão com a conta. Para desenvolvimento local queremos o D1/R2 do
 *    Miniflare — daí o `false`.
 *
 * Workers AI é a exceção: não há inferência local, então testar a adaptação
 * PT-BR exige binding remoto. Para isso:
 *   CLOUDFLARE_API_TOKEN=... CF_REMOTE_BINDINGS=true npm run dev
 */
void initOpenNextCloudflareForDev({
  remoteBindings: process.env.CF_REMOTE_BINDINGS === "true",
});
