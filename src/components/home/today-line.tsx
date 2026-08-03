import { connection } from "next/server";
import { chaveDoDia, diaPorExtenso, FUSO } from "@/lib/format";
import { buscarLiturgia, buscarUltimoDiaLiturgico } from "@/lib/articles";
import { LiturgyCard } from "./liturgy-card";
import { SaintCard } from "./saint-card";

/**
 * Os dois componentes deste arquivo leem o relógio. Sob Cache Components isso
 * exige DUAS coisas, e faltar qualquer uma delas quebra o `next build`:
 *
 * 1. `await connection()` antes de `new Date()`. O Next 16 recusa ler a hora
 *    atual num Server Component que ainda não tocou em nenhuma fonte dinâmica —
 *    senão o valor seria congelado no build e a home mostraria a data do deploy
 *    para sempre. (Erro literal: "used `new Date()` before accessing either
 *    uncached data or Request data".)
 *
 * 2. Uma fronteira de `<Suspense>` na página. É ela que permite prerenderizar a
 *    casca da capa e deixar só estas ilhas chegarem em streaming — o Partial
 *    Prerendering descrito no CLAUDE.md §2.
 */

/** Linha de data do masthead. Fuso fixo em `America/Sao_Paulo`. */
export async function TodayLine() {
  await connection();
  return (
    <p className="text-xs tracking-[0.12em] text-ink-3 uppercase">
      {diaPorExtenso(new Date())}
    </p>
  );
}

/** Reserva a altura exata da linha para o streaming não deslocar o título. */
export function TodayLineSkeleton() {
  return (
    <p aria-hidden="true" className="text-xs uppercase">
      <span className="inline-block h-[1em] w-[26ch] max-w-full rounded bg-surface-2 align-middle" />
    </p>
  );
}

/**
 * Coluna litúrgica da capa: liturgia do dia + santo do dia.
 *
 * ## Por que existe um estado de espera aqui
 *
 * Antes, sem linha para hoje, isto fazia `return null` e a coluna inteira
 * desaparecia da capa. Em 01/08/2026 foi exatamente o que aconteceu: o
 * calendário do Salve Maria terminava em 31/07 (a página do ano cresce mês a
 * mês) e o painel simplesmente sumiu, sem deixar rastro no site nem explicação
 * para o leitor — parecia funcionalidade removida, não fonte atrasada.
 *
 * O conserto de fundo é o cron diário, que repõe o mês em até 24h assim que a
 * fonte publicar. Este componente cobre a janela até lá.
 *
 * A regra que NÃO muda: liturgia não se inventa. Nada aqui deduz festa, cor ou
 * leitura a partir de outro ano — a única coisa exibida sem dado da fonte é a
 * data de hoje, que é aritmética de calendário civil, e o aviso do que está
 * faltando.
 */
export async function LiturgyPanel() {
  await connection();
  const agora = new Date();
  const hoje = chaveDoDia(agora);
  const dia = await buscarLiturgia(hoje);

  if (!dia) {
    const ultimo = await buscarUltimoDiaLiturgico();
    return <LiturgyPending hoje={agora} ultimoDia={ultimo} />;
  }

  return (
    <div className="flex flex-col gap-5">
      <LiturgyCard dia={dia} />
      <SaintCard dia={dia} />
    </div>
  );
}

/**
 * Estado de espera do calendário — honesto sobre o que falta e por quê.
 *
 * Ocupa a mesma silhueta dos dois cartões reais para a coluna não colapsar e
 * empurrar os destaques na dobra principal.
 */
function LiturgyPending({
  hoje,
  ultimoDia,
}: {
  hoje: Date;
  ultimoDia: string | undefined;
}) {
  return (
    <section
      aria-labelledby="liturgia-de-hoje"
      className="rounded-[18px] border border-line bg-surface p-6 shadow-card"
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id="liturgia-de-hoje"
          className="text-xs tracking-[0.12em] text-ink-3 uppercase"
        >
          Liturgia de hoje
        </h2>
        <span className="text-[11px] tracking-[0.08em] text-ink-3 uppercase">
          Missal de 1962
        </span>
      </div>

      <p className="mt-3.5 font-display text-[21px] leading-[1.15] font-semibold tracking-[-0.025em] text-balance">
        {diaPorExtenso(hoje)}
      </p>

      <p className="mt-4 border-t border-line pt-4 text-[14px] leading-[1.55] text-ink-2">
        As leituras e o santo de hoje ainda não foram publicados pelo calendário
        tradicional que seguimos
        {ultimoDia ? (
          <>
            {" "}
            — a fonte vai até{" "}
            <time dateTime={ultimoDia} className="font-medium text-ink">
              {formatarDiaCurto(ultimoDia)}
            </time>
          </>
        ) : null}
        . Assim que sair, esta coluna volta sozinha.
      </p>

      {/* Não inventamos liturgia: é preferível a coluna admitir a lacuna a
          exibir a festa de outro ano com cara de certeza. */}
      <p className="mt-3 text-[12px] leading-relaxed text-ink-3">
        Nunca publicamos liturgia estimada.
      </p>
    </section>
  );
}

/** `2026-07-31` → `31 de julho de 2026`. Entrada já é uma chave civil. */
function formatarDiaCurto(chaveIso: string): string {
  // `T12:00:00Z` e não meia-noite: com meia-noite UTC, qualquer fuso a oeste
  // renderizaria o dia anterior — e aqui a data exibida É a informação.
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${chaveIso}T12:00:00Z`));
}

/** Mesma silhueta dos dois cartões, para não haver salto de layout. */
export function LiturgyPanelSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-5">
      <div className="h-[318px] rounded-[18px] border border-line bg-surface shadow-card" />
      <div className="h-[150px] rounded-[18px] border border-line bg-surface-2" />
    </div>
  );
}
