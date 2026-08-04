import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Newsreader } from "next/font/google";
import "./globals.css";

/**
 * O design original carrega as fontes por <link> para fonts.googleapis.com, o
 * que é render-blocking e uma requisição a mais para um terceiro. Aqui elas são
 * auto-hospedadas pelo next/font — mesmo desenho, sem custo de LCP e sem o
 * salto de layout do swap. Conta direto para o orçamento do CLAUDE.md §1.
 */
const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  display: "swap",
  /**
   * Sem o peso 700. MEDIDO, não presumido: `grep -r "font-bold" src/` devolve
   * ZERO ocorrências, e o `<strong>` do corpo de matéria usa `font-semibold`
   * (600) — ver `src/components/article/article-body.tsx`. Cada peso × estilo é
   * um WOFF2 a mais que o next/font pré-carrega no caminho crítico.
   */
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  display: "swap",
  // 500 e 600 não aparecem em `font-serif` em lugar nenhum; 300 aparece uma vez
  // (`editorial.tsx`) e 400 é o corpo do artigo.
  weight: ["300", "400"],
  style: ["normal", "italic"],
  /**
   * `preload: false` é a mudança de maior efeito neste bloco.
   *
   * A serifada só é usada abaixo da dobra — corpo de matéria
   * (`article-body.tsx`) e a citação da faixa editorial. Pré-carregá-la disputa
   * banda com a imagem de destaque da capa, que é o LCP e tem `priority`. Sem o
   * preload ela é buscada quando o CSS de fato a pede, e `display: "swap"`
   * garante que o texto aparece antes disso.
   */
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default: "Minuto Católico",
    template: "%s · Minuto Católico",
  },
  description:
    "Notícias, documentos e vida da Igreja — com clareza e sem ruído.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "oklch(0.985 0.003 95)" },
    { media: "(prefers-color-scheme: dark)", color: "oklch(0.155 0.005 265)" },
  ],
};

/**
 * Aplica o tema salvo ANTES do primeiro paint.
 *
 * Sem isto, o servidor renderiza claro, o React hidrata e só então troca para
 * escuro — o usuário vê um flash branco a cada navegação. Precisa ser síncrono
 * e inline no <head>; qualquer coisa assíncrona chega tarde demais.
 */
const SCRIPT_TEMA = `
(function(){
  try {
    var t = localStorage.getItem('bn-theme');
    if (t !== 'light' && t !== 'dark') {
      t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.dataset.theme = t;
    document.documentElement.style.colorScheme = t;
  } catch (e) {
    document.documentElement.dataset.theme = 'light';
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      // suppressHydrationWarning porque o script acima altera data-theme antes
      // da hidratação — a divergência é intencional, não um bug.
      suppressHydrationWarning
      className={`${instrumentSans.variable} ${newsreader.variable}`}
    >
      <head>
        {/**
         * A imagem de destaque da capa e do artigo é o LCP, e ela vem sempre de
         * um destes hosts (ver `remotePatterns` em next.config.ts). Abrir a
         * conexão em paralelo com o HTML economiza DNS + TCP + TLS do caminho
         * crítico. `res.cloudinary.com` é o do EWTN, que serve a maioria.
         *
         * Só os hosts de IMAGEM entram aqui. Preconnect para a rede de anúncio
         * seria contato com terceiro antes do opt-in — ele vive dentro do
         * componente `Adcash`, no ramo já consentido.
         */}
        <link
          rel="preconnect"
          href="https://res.cloudinary.com"
          crossOrigin="anonymous"
        />
        <link rel="dns-prefetch" href="https://www.ewtnnews.com" />
        <link rel="dns-prefetch" href="https://www.signofthecrossmedia.com" />

        <script
          // Conteúdo estático definido em build. Não há entrada de usuário aqui.
          dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }}
        />
        {/**
         * ⚠️ NÃO recolocar script de anúncio aqui. Havia três (`aclib.js` +
         * dois `aclib.runAutoTag`), removidos em 03/08/2026 por quatro motivos
         * somados — e todos continuam valendo:
         *
         * 1. LEGAL. `/privacidade` afirmava por escrito que o site não tinha
         *    publicidade nem rastreador de terceiro, enquanto o script rodava
         *    em TODAS as páginas — inclusive na própria página de privacidade.
         *    Declaração falsa publicada é pior que política ausente.
         * 2. EDITORIAL. `runAutoTag` é o pacote 4-em-1 da Adcash: pop-under,
         *    intersticial, in-page push e video slider, com anti-adblock.
         *    Pop-under e intersticial estão na lista de menos preferidos do
         *    Coalition for Better Ads, e intersticial intrusivo é fator de
         *    rebaixamento no Google mobile — o oposto da meta do CLAUDE.md §1.
         * 3. PERFORMANCE. Eram síncronos no `<head>`: o parser parava antes de
         *    qualquer byte do `<body>` para resolver DNS+TLS de um terceiro,
         *    anulando o PPR da capa e as fontes auto-hospedadas.
         * 4. ESTABILIDADE. Eram `<script>{...}</script>` com children de
         *    texto — a construção que o MEMORY.md §5c registra como a que
         *    derrubou o site inteiro em 31/07 (stream RSC corrompido).
         *
         * O caminho correto está em `src/components/ads/` + `consent/`: banner
         * com slot dimensionado, via `next/script`, só depois de opt-in.
         */}
      </head>
      {/* O corte lateral vive no <html> (globals.css), não aqui: `overflow-x`
          no <body> propaga para a viewport e a torna contêiner de rolagem. */}
      <body className="min-h-screen bg-bg text-ink">
        {children}
      </body>
    </html>
  );
}
