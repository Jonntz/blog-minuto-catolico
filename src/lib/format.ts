/**
 * Formatação de data e tempo em pt-BR.
 *
 * Duas regras que valem para o portal inteiro:
 *
 * 1. **Fuso fixo em `America/Sao_Paulo`.** O servidor roda em UTC (Workers) e o
 *    leitor está no Brasil. Sem fixar o fuso, "hoje" no masthead viraria ontem
 *    depois das 21h — e a liturgia do dia sairia errada, que é o pior tipo de
 *    erro possível neste site.
 *
 * 2. **Datas absolutas, não relativas.** "há 3 horas" precisa do relógio do
 *    cliente para ser correto e, sob Cache Components, envenena qualquer cache
 *    com um valor que expira sozinho. Um portal de notícias ganha mais com
 *    "27 jul, 14:32" do que com um contador impreciso.
 *
 * Os timestamps do schema são unix em SEGUNDOS (ver `src/db/schema.ts`); todo
 * conversor aqui multiplica por 1000 antes de entregar ao `Date`.
 */

export const FUSO = "America/Sao_Paulo";
const LOCALE = "pt-BR";

/**
 * `Intl.DateTimeFormat` é caro de construir e barato de reusar. Como as opções
 * são fixas, as instâncias vivem no módulo em vez de nascerem a cada card.
 */
const fmtDataExtensa = new Intl.DateTimeFormat(LOCALE, {
  timeZone: FUSO,
  day: "numeric",
  month: "long",
  year: "numeric",
});

const fmtDataCurta = new Intl.DateTimeFormat(LOCALE, {
  timeZone: FUSO,
  day: "2-digit",
  month: "short",
});

const fmtHora = new Intl.DateTimeFormat(LOCALE, {
  timeZone: FUSO,
  hour: "2-digit",
  minute: "2-digit",
});

const fmtDiaSemana = new Intl.DateTimeFormat(LOCALE, {
  timeZone: FUSO,
  weekday: "long",
});

/** `en-CA` é o único locale que devolve `YYYY-MM-DD` puro — usado como chave. */
const fmtChaveIso = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function paraData(unixSegundos: number): Date {
  return new Date(unixSegundos * 1000);
}

/** `27 de julho de 2026` */
export function dataExtensa(unixSegundos: number): string {
  return fmtDataExtensa.format(paraData(unixSegundos));
}

/** `27 jul` — usado nas linhas de meta dos cards, onde espaço é escasso. */
export function dataCurta(unixSegundos: number): string {
  // O pt-BR devolve "27 de jul." — o ponto e o "de" só ocupam espaço no card.
  return fmtDataCurta
    .format(paraData(unixSegundos))
    .replace(/\sde\s/g, " ")
    .replace(/\.$/, "");
}

/** `27 jul, 14:32` */
export function dataHoraCurta(unixSegundos: number): string {
  const d = paraData(unixSegundos);
  return `${dataCurta(unixSegundos)}, ${fmtHora.format(d)}`;
}

/** `Segunda-feira, 27 de julho de 2026` — a linha do masthead. */
export function diaPorExtenso(data: Date): string {
  const semana = fmtDiaSemana.format(data);
  const dia = fmtDataExtensa.format(data);
  return `${semana.charAt(0).toUpperCase()}${semana.slice(1)}, ${dia}`;
}

/**
 * `YYYY-MM-DD` no fuso de São Paulo — a chave primária de `liturgical_days`.
 * Precisa bater exatamente com o que o parser do calendário grava lá.
 */
export function chaveDoDia(data: Date): string {
  return fmtChaveIso.format(data);
}

/** `datetime` do `<time>`: ISO 8601 completo, sempre em UTC. */
export function isoCompleto(unixSegundos: number): string {
  return paraData(unixSegundos).toISOString();
}

/**
 * Tempo de leitura em minutos.
 * 200 palavras/min é a média de leitura de notícia em português; arredondar para
 * cima evita prometer "1 min" para um texto de 1 min e 50 s.
 */
export function minutosDeLeitura(texto: string): number {
  const palavras = texto.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(palavras / 200));
}
