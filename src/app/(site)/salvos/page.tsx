import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeading } from "@/components/home/section-heading";
import { SavedArticlesList } from "@/components/news/saved-articles-list";
import { Container } from "@/components/ui/container";
import { ROTA_HOME } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Matérias salvas",
  description:
    "Lista de notícias salvas no seu navegador para leitura posterior.",
  // Depende do `localStorage` do leitor — não deve ser indexada pelo Google.
  robots: { index: false, follow: true },
};

export default function SalvosPage() {
  return (
    <Container as="section" className="py-12 sm:py-16">
      <nav aria-label="Trilha de navegação" className="mb-6">
        <ol className="flex flex-wrap items-center gap-2 text-xs tracking-[0.08em] text-ink-3 uppercase">
          <li>
            <Link
              href={ROTA_HOME}
              className="transition-colors duration-200 ease-dc hover:text-blue-f"
            >
              Capa
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>Matérias salvas</li>
        </ol>
      </nav>

      <SectionHeading
        id="titulo-salvos"
        nivel="h1"
        sobrancelha="Biblioteca pessoal"
        titulo="Matérias salvas"
        href={ROTA_HOME}
        rotuloDoLink="Voltar para a capa"
      />

      <p className="mt-4 max-w-[60ch] text-[15px] leading-[1.6] text-ink-2">
        Esta lista fica guardada apenas no armazenamento local deste navegador —
        não exige conta e não é enviada aos nossos servidores.
      </p>

      <SavedArticlesList />
    </Container>
  );
}
