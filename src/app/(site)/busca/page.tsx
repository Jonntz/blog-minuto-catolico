import type { Metadata } from "next";
import { Suspense } from "react";
import { ArticleCard } from "@/components/article/article-card";
import { SectionHeading } from "@/components/home/section-heading";
import { SiteSearch } from "@/components/layout/site-search";
import { Container } from "@/components/ui/container";
import { buscar } from "@/lib/articles";

interface Props {
  /** No Next 16 `searchParams` também é Promise. */
  searchParams: Promise<{ q?: string }>;
}

export const metadata: Metadata = {
  title: "Busca",
  // Página de resultado não deve competir no índice com as matérias em si, e
  // combinações de termo geram infinitas URLs rasas.
  robots: { index: false, follow: true },
};

export default function SearchPage({ searchParams }: Props) {
  // `searchParams` é dado de requisição: consumido dentro do Suspense, para a
  // casca da página continuar prerenderizável.
  return (
    <Container as="section" className="py-12 sm:py-16">
      <Suspense fallback={null}>
        <Resultados searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

async function Resultados({ searchParams }: Props) {
  const { q } = await searchParams;
  const termo = q?.trim() ?? "";
  const resultados = termo ? await buscar(termo) : [];

  return (
    <>
      <SectionHeading
        id="titulo-da-busca"
        nivel="h1"
        sobrancelha="Busca"
        titulo={termo ? `Resultados para “${termo}”` : "Buscar no portal"}
        contador={
          termo
            ? `${resultados.length} ${resultados.length === 1 ? "matéria" : "matérias"}`
            : undefined
        }
      />

      <div className="mt-6 max-w-[420px]">
        <SiteSearch variante="mobile" />
      </div>

      <div className="mt-8">
        {!termo ? (
          <p className="text-[15px] text-ink-2">
            Digite ao menos duas letras para buscar entre as matérias
            publicadas.
          </p>
        ) : resultados.length === 0 ? (
          <p className="text-[15px] text-ink-2">
            Nenhuma matéria encontrada para “{termo}”. Tente outro termo ou
            navegue pelas editorias no menu.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {resultados.map((artigo) => (
              <ArticleCard
                key={artigo.slug}
                artigo={artigo}
                nivelDoTitulo="h2"
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
