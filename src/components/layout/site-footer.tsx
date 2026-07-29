import Link from "next/link";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
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
          <Link
            href={item.href}
            className="text-sm text-ink-2 transition-colors duration-200 ease-dc hover:text-blue-f"
          >
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
