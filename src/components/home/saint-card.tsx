import type { LiturgicalDay } from "@/db/schema";

/**
 * "Santo do dia".
 *
 * Alimentado por `marianSaint` + `feast`. `marianSaint` é a coluna "Calendário
 * Mariano" da fonte (salvemaria.com.br) — o santo congregado do dia. Quando ela
 * vem vazia, a festa assume o lugar.
 *
 * Duas armadilhas do calendário de 1962 tratadas aqui:
 *
 * - Numa **féria** o campo `feast` vale literalmente "Féria". Escrever "Na
 *   festa de Féria" seria absurdo, então a linha de contexto some nesses dias.
 * - A **comemoração** não é repetida: ela já aparece no cartão de liturgia logo
 *   acima, e nas férias costuma ser o mesmo santo que dá nome a este cartão.
 */
export function SaintCard({ dia }: { dia: LiturgicalDay }) {
  const nome = dia.marianSaint ?? dia.feast;
  const ehFeria = dia.feast.startsWith("Féria");
  const mostrarFesta = !ehFeria && dia.feast !== nome;

  return (
    <section
      aria-labelledby="santo-do-dia"
      className="rounded-[18px] border border-line bg-surface-2 p-6"
    >
      <h2
        id="santo-do-dia"
        className="text-xs tracking-[0.12em] text-ink-3 uppercase"
      >
        Santo do dia
      </h2>

      <p className="mt-3.5 font-display text-[19px] leading-[1.18] font-semibold tracking-[-0.02em] text-balance">
        {nome}
      </p>

      {mostrarFesta ? (
        <p className="mt-2 text-[13px] leading-[1.5] text-ink-2">
          Na festa de {dia.feast}.
        </p>
      ) : null}

      {dia.marianSaint ? (
        <p className="mt-3 text-[11px] tracking-[0.1em] text-ink-3 uppercase">
          Calendário mariano
        </p>
      ) : null}
    </section>
  );
}
