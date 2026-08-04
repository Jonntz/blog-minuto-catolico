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

    /**
     * Larguras DERIVADAS dos `sizes` que o projeto realmente usa, não o padrão
     * do Next.
     *
     * Os slots reais são: 1160px (imagem do artigo), 780px (destaque da capa),
     * 420px (faixa editorial), 380px (card em grade) — e `100vw` no celular.
     * O default do Next são 8 `deviceSizes`; com dois formatos (`avif`+`webp`),
     * cada imagem vira até 16 variantes a otimizar e guardar. Como as imagens
     * vêm de CDN de terceiro e cada variante é um miss que custa CPU do Worker,
     * cortar a lista é ganho direto.
     *
     * Ao mudar um `sizes` em `article-card`, `article-header` ou `editorial`,
     * conferir se a largura correspondente está aqui.
     */
    deviceSizes: [384, 640, 750, 828, 1080, 1200, 1920],
    imageSizes: [96, 128, 256, 384],

    /**
     * As fontes publicam a imagem uma vez e não a trocam. Um dia de cache no
     * lado do Next evita reotimizar a mesma URL a cada isolate frio.
     */
    minimumCacheTTL: 86_400,

    /**
     * O Next 16 exige declarar as qualidades permitidas. Só 75 (o padrão) é
     * usado no projeto — declarar uma lista curta impede que uma URL forjada
     * com `?q=100` faça o Worker gerar variantes fora do previsto.
     */
    qualities: [75],
  },

  /**
   * Cabeçalhos de segurança do HTML servido pelo Next.
   *
   * ## Por que AQUI e também em `public/_headers`
   *
   * Os dois arquivos cobrem coisas diferentes e **não se substituem**:
   *  - Este `headers()` entra no `routes-manifest.json` e é aplicado pelo
   *    matcher do OpenNext — cobre o HTML renderizado no servidor, que é
   *    praticamente todo o site.
   *  - `public/_headers` só é lido pelo *asset handler* do Workers — cobre
   *    `/_next/static/*`, imagens e o resto do `public/`.
   *
   * Consolidar os dois num só é o erro clássico de quem porta configuração de
   * Cloudflare Pages: derruba metade da cobertura sem aviso.
   *
   * ## O que NÃO está aqui
   *
   * `Strict-Transport-Security` fica no painel da Cloudflare, de propósito. Lá
   * é reversível em segundos; servido por código, um `max-age` longo enviado
   * por engano gruda no navegador de cada visitante até expirar.
   *
   * `Content-Security-Policy` completa também não: CSP com nonce exige
   * middleware, e `src/lib/cron-auth.ts` documenta que não há middleware
   * possível neste alvo de deploy. Sem nonce, os scripts inline do próprio Next
   * (`self.__next_f.push`) obrigariam `script-src 'unsafe-inline'`, que anula o
   * valor da diretiva. As diretivas abaixo são as que funcionam SEM nonce e não
   * dependem de conhecer os domínios da rede de anúncio.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Impede o navegador de adivinhar o tipo de um recurso — o vetor
          // clássico de transformar upload/asset em script executável.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Preserva a atribuição de tráfego (o Referer continua indo para o
          // mesmo site e para origens externas em HTTPS), sem vazar o caminho
          // completo para terceiro.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            // `browsing-topics=()` é coerência, não paranoia: a política de
            // privacidade promete não fazer publicidade comportamental, e a
            // Topics API é exatamente isso.
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
          },
          {
            // `same-origin-allow-popups`, e NÃO `same-origin`: o segundo
            // quebraria `window.open` — inclusive o compartilhamento em
            // `src/components/article/article-actions.tsx`.
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            // Diretivas que valem sem nonce e não conflitam com rede de
            // anúncio. `frame-ancestors` é o que de fato barra clickjacking
            // (o X-Frame-Options acima é o fallback para navegador antigo).
            key: "Content-Security-Policy",
            value: [
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
            ].join("; "),
          },
        ],
      },
    ];
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
