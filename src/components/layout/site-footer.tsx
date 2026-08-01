import Link from "next/link";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import {
  PAGINAS_INSTITUCIONAIS,
  ROTA_ARQUIVO,
  rotaInstitucional,
} from "@/lib/seo";
import { itensDoRodape } from "./nav";

/**
 * Rodapé do design: marca, editorias e a nota de proveniência.
 *
 * A nota sobre adaptação e link para a fonte não é enfeite jurídico — é o
 * compromisso editorial do CLAUDE.md §6 escrito onde o leitor pode ler. Um
 * portal que reescreve matéria alheia precisa dizer isso em público.
 */
export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line bg-surface-2">
      <Container className="py-14">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="max-w-[38ch]">
            <p className="font-display text-[19px] font-semibold tracking-[-0.025em]">
              Minuto Católico
            </p>
            <p className="mt-2.5 text-sm leading-relaxed text-ink-2">
              Notícias, documentos e vida da Igreja — com clareza e sem ruído.
            </p>
          </div>

          <div className="flex flex-col gap-10 sm:flex-row sm:gap-16">
            <nav aria-label="Editorias">
              <p className="mb-3.5 text-xs tracking-[0.12em] text-ink-3 uppercase">
                Editorias
              </p>
              {/* A lista depende do D1 (só editoria com conteúdo entra), e o
                  binding não existe em tempo de build — daí a fronteira de
                  streaming. O resto do rodapé é prerenderizado. */}
              <Suspense fallback={<div className="h-24" />}>
                <ListaDeEditorias />
              </Suspense>
            </nav>

            {/* Institucional é conteúdo estático: fica FORA do Suspense, e por
                isso é prerenderizado junto com a casca. Ter privacidade e
                política editorial alcançáveis de qualquer página é requisito de
                confiança (e de E-E-A-T), não enfeite de rodapé. */}
            <nav aria-label="Institucional">
              <p className="mb-3.5 text-xs tracking-[0.12em] text-ink-3 uppercase">
                O portal
              </p>
              <ul className="flex flex-col gap-2.5">
                <li>
                  <LinkDoRodape href={ROTA_ARQUIVO}>
                    Todas as notícias
                  </LinkDoRodape>
                </li>
                {PAGINAS_INSTITUCIONAIS.map((pagina) => (
                  <li key={pagina.slug}>
                    <LinkDoRodape href={rotaInstitucional(pagina.slug)}>
                      {pagina.titulo}
                    </LinkDoRodape>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>

        <div className="mt-12 border-t border-line pt-6">
          <p className="max-w-[70ch] text-xs leading-relaxed text-ink-3">
            As matérias são adaptadas em português a partir das fontes
            indicadas, com link para o texto original. Nenhum conteúdo é
            republicado na íntegra.
          </p>
          <p className="mt-3 text-xs text-ink-3">
            © 2026 Minuto Católico
          </p>
        </div>
      </Container>
    </footer>
  );
}

async function ListaDeEditorias() {
  const editorias = await itensDoRodape();

  return (
    <ul className="grid grid-cols-2 gap-x-10 gap-y-2.5">
      {editorias.map((item) => (
        <li key={item.href}>
          <LinkDoRodape href={item.href}>{item.label}</LinkDoRodape>
        </li>
      ))}
    </ul>
  );
}

function LinkDoRodape({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="text-sm text-ink-2 transition-colors duration-200 ease-dc hover:text-blue-f"
    >
      {children}
    </Link>
  );
}
