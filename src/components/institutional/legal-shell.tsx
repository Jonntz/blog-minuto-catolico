import Link from "next/link";
import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";
import { ATUALIZADO_EM } from "@/lib/institucional";

/**
 * Casca das páginas institucionais.
 *
 * A tipografia do corpo é aplicada por seletores de filho no wrapper em vez de
 * classe em cada elemento. Não é preguiça: o texto destas páginas é prosa longa
 * e escrita à mão, e obrigar quem editar o texto a lembrar de sete classes por
 * parágrafo é como as páginas legais de um site acabam com quatro estilos
 * diferentes de `<h2>`. O plugin de tipografia do Tailwind resolveria isso, mas
 * não está no projeto e não vale um pacote novo para cinco páginas.
 *
 * `max-w-[68ch]`: mesma lógica da medida de leitura da matéria — texto legal é
 * o que menos perdoa linha longa, porque ninguém relê por prazer.
 */
export function LegalShell({
  titulo,
  resumo,
  children,
  mostrarAtualizacao = true,
}: {
  titulo: string;
  /** Uma frase que diz do que trata a página, antes do corpo. */
  resumo: string;
  children: ReactNode;
  mostrarAtualizacao?: boolean;
}) {
  return (
    <Container as="article" className="py-12 sm:py-16">
      <div className="mx-auto max-w-[68ch]">
        <nav aria-label="Trilha de navegação" className="mb-7">
          <ol className="flex flex-wrap items-center gap-2 text-xs tracking-[0.08em] text-ink-3 uppercase">
            <li>
              <Link
                href="/"
                className="transition-colors duration-200 ease-dc hover:text-blue-f"
              >
                Capa
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>{titulo}</li>
          </ol>
        </nav>

        <h1 className="font-display text-[34px] leading-[1.04] font-semibold tracking-[-0.035em] break-words text-balance sm:text-[44px]">
          {titulo}
        </h1>

        <p className="mt-5 max-w-[62ch] text-[18px] leading-[1.5] break-words text-ink-2 sm:text-[20px]">
          {resumo}
        </p>

        {mostrarAtualizacao ? (
          <p className="mt-6 border-y border-line py-4 text-[13px] text-ink-3">
            Última atualização: {ATUALIZADO_EM}
          </p>
        ) : null}

        <div
          className={[
            "mt-10 text-[16px] leading-[1.7] break-words text-ink-2",
            "[&_h2]:mt-11 [&_h2]:mb-4 [&_h2]:font-display [&_h2]:text-[22px] [&_h2]:leading-[1.15] [&_h2]:font-semibold [&_h2]:tracking-[-0.025em] [&_h2]:text-ink [&_h2]:text-balance sm:[&_h2]:text-[25px]",
            "[&_h3]:mt-8 [&_h3]:mb-3 [&_h3]:font-display [&_h3]:text-[17px] [&_h3]:font-semibold [&_h3]:tracking-[-0.02em] [&_h3]:text-ink",
            "[&_p]:my-4",
            "[&_ul]:my-5 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5",
            "[&_ol]:my-5 [&_ol]:flex [&_ol]:list-decimal [&_ol]:flex-col [&_ol]:gap-2 [&_ol]:pl-5",
            "[&_li]:pl-1",
            "[&_strong]:font-semibold [&_strong]:text-ink",
            "[&_a]:text-blue-f [&_a]:underline [&_a]:underline-offset-2",
            "[&_dl]:my-5 [&_dl]:flex [&_dl]:flex-col [&_dl]:gap-4",
            "[&_dt]:font-semibold [&_dt]:text-ink",
            "[&_dd]:mt-1",
          ].join(" ")}
        >
          {children}
        </div>
      </div>
    </Container>
  );
}

/**
 * Bloco de aviso para o que ainda depende de decisão do responsável pelo site.
 *
 * Existe para que a ausência de um dado (e-mail do titular, razão social) seja
 * VISÍVEL em vez de silenciosa. Uma política de privacidade que promete um
 * canal inexistente é um problema jurídico; uma que diz "estamos definindo" é
 * só uma pendência.
 */
export function AvisoPendente({ children }: { children: ReactNode }) {
  return (
    <p className="my-5 rounded-[14px] border border-line bg-surface-2 p-5 text-[15px] leading-[1.6] text-ink-2">
      {children}
    </p>
  );
}
