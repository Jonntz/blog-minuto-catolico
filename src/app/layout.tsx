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
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
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
        <script
          // Conteúdo estático definido em build. Não há entrada de usuário aqui.
          dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }}
        />
        <script id="aclib" type="text/javascript" src="//acscdn.com/script/aclib.js" />
        <script type="text/javascript">
          {`aclib.runAutoTag({ zoneId: 'pcewqvqovo' });`}
        </script>

        <script type="text/javascript">
          {`aclib.runAutoTag({ zoneId: 'xlwsd0rw7w' });`}
        </script>
      </head>
      {/* O corte lateral vive no <html> (globals.css), não aqui: `overflow-x`
          no <body> propaga para a viewport e a torna contêiner de rolagem. */}
      <body className="min-h-screen bg-bg text-ink">
        {children}
      </body>
    </html>
  );
}
