"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * O reveal por scroll do design: o bloco sobe 14px e aparece quando entra na
 * viewport (keyframe `bnIn`, easing `--ease-dc`, ambos já em `globals.css`).
 *
 * Duas correções em relação ao design original:
 *
 * 1. **`prefers-reduced-motion` é respeitado.** O mockup animava todo mundo. Se
 *    a pessoa pediu menos movimento, o conteúdo já nasce visível e o observer
 *    nem chega a ser criado — não basta encurtar a animação, é preciso não
 *    esconder o conteúdo em primeiro lugar.
 *
 * 2. **O observer se desconecta no primeiro disparo.** O design reobservava
 *    para sempre; manter dezenas de observers vivos numa capa longa é custo de
 *    main thread sem contrapartida, já que a animação só toca uma vez.
 *
 * Use somente ABAIXO da dobra. Acima dela o estado inicial invisível atrasaria
 * o LCP — que é exatamente o oposto do que o CLAUDE.md §1 pede.
 */
export function Reveal({
  children,
  delayMs = 0,
  className,
}: {
  children: React.ReactNode;
  delayMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const semMovimento = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (semMovimento || typeof IntersectionObserver === "undefined") {
      setVisivel(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setVisivel(true);
          observer.disconnect();
        }
      },
      // Dispara um pouco antes de o bloco encostar na borda: a animação começa
      // enquanto ainda está fora de vista e termina já com o bloco na tela.
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-reveal=""
      className={cn(
        visivel
          ? "animate-[bnIn_0.62s_var(--ease-dc)_both]"
          : "opacity-0 will-change-[opacity,transform]",
        className,
      )}
      style={visivel && delayMs > 0 ? { animationDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}
