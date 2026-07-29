import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { TodayLine, TodayLineSkeleton } from "./today-line";

/**
 * Masthead da capa. É o LCP da home, então não leva reveal nem animação de
 * entrada: qualquer estado inicial invisível aqui vira atraso medido.
 */
export function Masthead() {
  return (
    <Container as="section" className="pt-12 pb-9 sm:pt-16 sm:pb-12">
      <Suspense fallback={<TodayLineSkeleton />}>
        <TodayLine />
      </Suspense>

      <h1 className="mt-3.5 max-w-[16ch] font-display text-[44px] leading-[0.98] font-semibold tracking-[-0.035em] sm:text-[64px]">
        Minuto Católico
      </h1>

      <p className="mt-4 max-w-[54ch] text-[17px] leading-[1.55] text-ink-2 sm:text-lg">
        Notícias, documentos e vida da Igreja — com clareza e sem ruído. Cada
        matéria é adaptada em português e traz o link para a fonte original.
      </p>
    </Container>
  );
}
