import type { Metadata } from "next";
import Link from "next/link";
import { metadataNaoEncontrado, ROTA_ARQUIVO } from "@/lib/seo";

/**
 * 404 do portal.
 *
 * Não existia: os três `notFound()` do projeto (matéria inexistente, categoria
 * inválida, editoria vazia) caíam na página embutida do Next — tela branca com
 * "404 | This page could not be found", em inglês, sem cabeçalho, sem rodapé e
 * sem nenhuma saída para o leitor. Numa auditoria de rede de anúncios isso
 * conta como página quebrada; para quem chega por link velho de rede social,
 * conta como site fora do ar.
 *
 * Fica na RAIZ (`src/app/`), e não em `(site)/`: um `not-found.tsx` dentro do
 * route group não é acionado por URLs que não casam com rota nenhuma. Como o
 * arquivo mora fora de `(site)`, ele não herda header nem rodapé — daí a
 * navegação explícita no corpo.
 *
 * `metadataNaoEncontrado()` existia em `src/lib/seo.ts` desde a Fase 1.D e só
 * era usada em `generateMetadata` de outras páginas. É ela que garante o
 * `noindex, follow`: sem isso, o Google indexaria a página de erro.
 */
export const metadata: Metadata = metadataNaoEncontrado();

const ATALHOS = [
  { href: "/", rotulo: "Capa" },
  { href: ROTA_ARQUIVO, rotulo: "Todas as notícias" },
  { href: "/sobre", rotulo: "Sobre o portal" },
] as const;

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-[clamp(16px,4vw,32px)] py-16">
      <div className="w-full max-w-[52ch] text-center">
        <p className="text-xs tracking-[0.12em] text-ink-3 uppercase">
          Erro 404
        </p>

        <h1 className="mt-3 font-display text-[clamp(28px,4.5vw,44px)] leading-[1.1] font-semibold tracking-[-0.03em] text-balance">
          Esta página não existe
        </h1>

        <p className="mx-auto mt-4 max-w-[44ch] text-[17px] leading-[1.55] text-ink-2">
          O endereço pode ter mudado, ou a matéria pode ter sido removida.
          Nenhuma notícia publicada é apagada sem motivo — se você chegou por um
          link antigo, provavelmente ela está no arquivo.
        </p>

        <nav
          aria-label="Atalhos"
          className="mt-8 flex flex-wrap justify-center gap-2.5"
        >
          {ATALHOS.map((atalho) => (
            <Link
              key={atalho.href}
              href={atalho.href}
              className="inline-flex min-h-11 touch-manipulation items-center rounded-full border border-line bg-surface px-5 text-[14px] font-medium text-ink transition-colors duration-200 ease-dc hover:border-blue-f hover:text-blue-f"
            >
              {atalho.rotulo}
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
