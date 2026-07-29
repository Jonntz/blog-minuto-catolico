import { connection } from "next/server";
import { chaveDoDia, diaPorExtenso } from "@/lib/format";
import { buscarLiturgia } from "@/lib/articles";
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

/** Coluna litúrgica da capa: liturgia do dia + santo do dia. */
export async function LiturgyPanel() {
  await connection();
  const hoje = chaveDoDia(new Date());
  const dia = await buscarLiturgia(hoje);

  // Sem linha para hoje no calendário, a coluna inteira não é renderizada.
  // É o estado real antes do primeiro `POST /api/cron/liturgy`, e também o de
  // uma data fora do intervalo já raspado. Mostrar cartões vazios seria pior
  // que não mostrar nada — e inventar liturgia, muito pior ainda.
  if (!dia) return null;

  return (
    <div className="flex flex-col gap-5">
      <LiturgyCard dia={dia} />
      <SaintCard dia={dia} />
    </div>
  );
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
