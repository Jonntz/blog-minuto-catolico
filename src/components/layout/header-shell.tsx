"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Casca interativa do cabeçalho: esconde ao rolar para baixo, reaparece ao
 * rolar para cima, e desenha a barra de progresso de leitura.
 *
 * É um wrapper que recebe `children` justamente para que a marca, a navegação e
 * os links continuem sendo Server Components — só o comportamento de scroll
 * atravessa a fronteira do cliente. O bundle deste arquivo é o listener e nada
 * mais.
 *
 * Decisões de performance (CLAUDE.md §1 — orçamento de INP):
 *
 * - Listener `passive: true`. Sem isso o navegador precisa esperar o handler
 *   para saber se houve `preventDefault`, e a rolagem engasga no celular.
 * - Leitura de layout dentro de `requestAnimationFrame`, uma vez por quadro.
 * - A barra de progresso é escrita direto no `style.transform` via ref. Ela
 *   muda a cada pixel de rolagem; passar isso por `useState` seria um render de
 *   React por quadro para animar uma única linha.
 * - `setEscondido` recebe um booleano derivado, então na esmagadora maioria dos
 *   quadros o valor é igual ao anterior e o React aborta o render sozinho.
 */
export function HeaderShell({ children }: { children: React.ReactNode }) {
  const [escondido, setEscondido] = useState(false);
  const barraRef = useRef<HTMLDivElement>(null);
  const ultimoY = useRef(0);
  const agendado = useRef(false);

  useEffect(() => {
    function medir() {
      agendado.current = false;

      const y = window.scrollY;
      const alturaRolavel =
        document.documentElement.scrollHeight - window.innerHeight;
      const progresso =
        alturaRolavel > 0 ? Math.min(1, Math.max(0, y / alturaRolavel)) : 0;

      const barra = barraRef.current;
      if (barra) barra.style.transform = `scaleX(${progresso})`;

      const descendo = y > ultimoY.current;
      ultimoY.current = y;

      // O limiar de 140px evita que o cabeçalho suma no primeiro toque de
      // rolagem, quando o masthead ainda está na tela.
      setEscondido(descendo && y > 140);
    }

    function aoRolar() {
      if (agendado.current) return;
      agendado.current = true;
      requestAnimationFrame(medir);
    }

    window.addEventListener("scroll", aoRolar, { passive: true });
    window.addEventListener("resize", aoRolar, { passive: true });
    medir();

    return () => {
      window.removeEventListener("scroll", aoRolar);
      window.removeEventListener("resize", aoRolar);
    };
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-transform duration-300 ease-dc",
        escondido && "-translate-y-full",
      )}
    >
      <div className="h-[54px] border-b border-line bg-nav backdrop-blur-xl">
        {children}
      </div>

      {/* Progresso de leitura. `aria-hidden` porque é redundante: a posição na
          página já é informada pela barra de rolagem nativa, e um leitor de
          tela não ganha nada com uma porcentagem duplicada. */}
      <div aria-hidden="true" className="h-[3px] w-full overflow-hidden">
        <div
          ref={barraRef}
          className="h-full w-full origin-left scale-x-0 bg-blue-f"
        />
      </div>
    </header>
  );
}
