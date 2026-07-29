import type { LiturgicalDay } from "@/db/schema";
import { cn } from "@/lib/utils";

/**
 * Cor da vestimenta do dia.
 *
 * São valores de CONTEÚDO, não do tema: verde é verde no claro e no escuro,
 * porque a informação é "o padre está de verde". Ficam em oklch como o resto do
 * design, com anel de contorno para que Branco não suma no cartão claro nem
 * Preto no escuro.
 *
 * A cor nunca é o único canal — o nome vem escrito ao lado (WCAG 1.4.1).
 */
const CLASSE_DA_COR: Readonly<Record<string, string>> = {
  Branco: "bg-[oklch(0.98_0_0)]",
  Verde: "bg-[oklch(0.6_0.14_150)]",
  Vermelho: "bg-[oklch(0.58_0.19_27)]",
  Roxo: "bg-[oklch(0.48_0.16_305)]",
  Rosa: "bg-[oklch(0.78_0.11_350)]",
  Preto: "bg-[oklch(0.25_0.01_265)]",
};

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-line pt-2.5">
      <dt className="shrink-0 text-[11px] tracking-[0.1em] text-ink-3 uppercase">
        {rotulo}
      </dt>
      <dd className="text-right text-[14px] font-medium text-ink">{valor}</dd>
    </div>
  );
}

/**
 * "Liturgia de hoje" — calendário TRADICIONAL de 1962.
 *
 * Esta é a correção mais importante do porte. O mockup mostrava
 * `1ª leitura / Salmo / Evangelho`, que é a estrutura do Novus Ordo. Na missa
 * tridentina **não existe salmo responsorial**: o par é `Epístola` e
 * `Evangelho`, e é isso que `liturgical_days` guarda (ver o comentário do
 * schema). Renderizar "Salmo" aqui seria informação litúrgica falsa num site
 * cujo público repara exatamente nisso.
 *
 * Junto com as leituras entram três dados que o Novus Ordo não usa do mesmo
 * jeito e que o missal de 1962 usa o tempo todo: a **classe** da festa (que
 * decide a precedência quando duas caem no mesmo dia), a **cor** e o
 * **prefácio**.
 */
export function LiturgyCard({ dia }: { dia: LiturgicalDay }) {
  const classeDaCor = dia.color ? CLASSE_DA_COR[dia.color] : undefined;

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
        {dia.feast}
        {dia.classis ? (
          <>
            <span aria-hidden="true" className="text-ink-3">
              {" · "}
            </span>
            <span className="text-ink-3">{dia.classis}</span>
          </>
        ) : null}
      </p>

      {dia.commemoration ? (
        <p className="mt-2 text-[14px] leading-[1.5] text-ink-2">
          {dia.commemoration}
        </p>
      ) : null}

      <dl className="mt-5 flex flex-col gap-2.5">
        {dia.epistle ? <Linha rotulo="Epístola" valor={dia.epistle} /> : null}
        {dia.gospel ? <Linha rotulo="Evangelho" valor={dia.gospel} /> : null}
      </dl>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-4 text-[13px] text-ink-2">
        {dia.color ? (
          <span className="inline-flex items-center gap-2">
            <span
              aria-hidden="true"
              className={cn(
                "size-3 rounded-full ring-1 ring-line",
                classeDaCor ?? "bg-neut-b",
              )}
            />
            {dia.color}
          </span>
        ) : null}
        {dia.preface ? <span>{dia.preface}</span> : null}
      </div>

      {dia.note ? (
        <p className="mt-3 text-[12px] leading-relaxed text-ink-3">{dia.note}</p>
      ) : null}
    </section>
  );
}
