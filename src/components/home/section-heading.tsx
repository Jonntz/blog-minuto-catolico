import Link from "next/link";

/**
 * Cabeçalho de seção do design: sobrancelha em caixa alta, título display e um
 * link opcional à direita.
 *
 * `id` é obrigatório porque toda seção da capa é referenciada por
 * `aria-labelledby` — sem isso um leitor de tela percorre uma sequência de
 * regiões sem nome.
 */
export function SectionHeading({
  id,
  sobrancelha,
  titulo,
  href,
  rotuloDoLink,
  contador,
  nivel = "h2",
}: {
  id: string;
  sobrancelha: string;
  titulo: string;
  href?: string;
  rotuloDoLink?: string;
  /** Contagem à direita, como o `latestCount` do design ("9 matérias"). */
  contador?: string;
  /**
   * `h2` na capa, onde o `h1` é o masthead. `h1` na página de editoria, que
   * não tem outro título acima — uma página sem `h1` deixa a hierarquia de
   * cabeçalhos quebrada para quem navega por estrutura.
   */
  nivel?: "h1" | "h2";
}) {
  const Titulo = nivel;

  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-line pb-4">
      <div className="min-w-0">
        <p className="text-xs tracking-[0.12em] text-ink-3 uppercase">
          {sobrancelha}
        </p>
        <Titulo
          id={id}
          className="mt-2 font-display text-[26px] leading-[1.06] font-semibold tracking-[-0.03em] text-balance sm:text-[32px]"
        >
          {titulo}
        </Titulo>
      </div>

      {href && rotuloDoLink ? (
        <Link
          href={href}
          className="text-[13px] font-medium text-ink-2 transition-colors duration-200 ease-dc hover:text-blue-f"
        >
          {rotuloDoLink} <span aria-hidden="true">→</span>
        </Link>
      ) : contador ? (
        <span className="text-[13px] whitespace-nowrap text-ink-3">
          {contador}
        </span>
      ) : null}
    </div>
  );
}
