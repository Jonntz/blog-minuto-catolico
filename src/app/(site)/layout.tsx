import { ConsentGate } from "@/components/consent/consent-gate";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

/**
 * Casca do site público.
 *
 * Está num route group `(site)` — não muda nenhuma URL, mas separa capa,
 * categoria e matéria do que vier depois com outra casca (o painel `(admin)`
 * previsto no CLAUDE.md §3, que não deve herdar header nem rodapé públicos).
 *
 * O `pt-[57px]` compensa a altura do cabeçalho fixo (54px + 3px da barra de
 * progresso). É padding e não margin de propósito: margin colapsaria com a do
 * primeiro filho e o masthead subiria por baixo do header.
 */
export default function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {/* Sem isto, quem navega por teclado passa por marca, cinco links de
          editoria e três botões antes de chegar à primeira manchete — em toda
          página. O link só aparece quando recebe foco. */}
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-full focus:border focus:border-line focus:bg-surface focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:shadow-card"
      >
        Pular para o conteúdo
      </a>

      <SiteHeader />

      <main id="conteudo" className="pt-[57px]">
        {children}
      </main>

      <SiteFooter />

      {/* Depois do rodapé: o banner é `fixed`, então a posição no DOM não muda
          onde ele aparece — mas ficar por último mantém a ordem de leitura e de
          tabulação com o conteúdo primeiro. */}
      <ConsentGate />
    </>
  );
}
