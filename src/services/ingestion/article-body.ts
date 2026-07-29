import { Parser } from "htmlparser2";

/**
 * Extração do corpo da matéria a partir do HTML da página da fonte.
 *
 * Existe por um motivo concreto: o feed do Sign of the Cross traz apenas um
 * excerpt de 49 a 709 caracteres, e o pré-voo da adaptação exige ao menos 1.750
 * — adaptar a partir de menos que isso exigiria inventar. Sem esta extração,
 * **0 de 25 matérias do SOTC eram publicáveis**; com ela, o material bruto
 * passa a ser equivalente ao do EWTN (que já traz `content:encoded`).
 *
 * O texto extraído é matéria-prima para a adaptação — NUNCA é publicado como
 * está (CLAUDE.md §6). Quem garante isso são os guard-rails de proporção.
 *
 * Usa `htmlparser2` (compatível com Workers). Nada de `cheerio` ou `jsdom`.
 */

/** Contêineres de corpo em ordem de preferência. WordPress usa o primeiro. */
const CLASSES_DE_CORPO = [
  "entry-content",
  "post-content",
  "article-content",
  "wp-block-post-content",
  "td-post-content",
];

/** Blocos que ficam DENTRO do corpo mas não são corpo. */
const TAGS_IGNORADAS = new Set([
  "script",
  "style",
  "noscript",
  "figcaption",
  "aside",
  "nav",
  "form",
  "button",
]);

/**
 * Parágrafos curtos são legenda, crédito, compartilhamento ou boilerplate
 * ("Sign up for our newsletter"). 80 caracteres separa isso de frase real.
 */
const MIN_CHARS_PARAGRAFO = 80;

export interface CorpoExtraido {
  texto: string;
  paragrafos: number;
  /** `true` quando veio de um contêiner conhecido; `false` no modo de reserva. */
  porContainer: boolean;
}

/**
 * Extrai os parágrafos do corpo.
 *
 * Duas estratégias, nesta ordem:
 *  1. Dentro de um contêiner conhecido (`entry-content` etc.) — preciso.
 *  2. Todos os `<p>` longos do documento — reserva. Funciona porque cabeçalho,
 *     menu e rodapé raramente têm parágrafo com mais de 80 caracteres.
 */
export function extrairCorpoArtigo(html: string): CorpoExtraido | null {
  const doContainer = coletar(html, true);
  if (doContainer && doContainer.paragrafos >= 3) return doContainer;

  const deReserva = coletar(html, false);
  if (deReserva && deReserva.paragrafos >= 3) return deReserva;

  return doContainer ?? deReserva;
}

function coletar(html: string, exigirContainer: boolean): CorpoExtraido | null {
  const paragrafos: string[] = [];

  let profundidade = 0;
  let profundidadeContainer = -1;
  let dentroDeP = false;
  let ignorandoAte = -1;
  let atual = "";

  const parser = new Parser(
    {
      onopentag(nome, atributos) {
        profundidade++;

        if (ignorandoAte === -1 && TAGS_IGNORADAS.has(nome)) {
          ignorandoAte = profundidade;
          return;
        }
        if (ignorandoAte !== -1) return;

        if (exigirContainer && profundidadeContainer === -1) {
          const classe = String(atributos.class ?? "");
          if (CLASSES_DE_CORPO.some((c) => classe.split(/\s+/).includes(c))) {
            profundidadeContainer = profundidade;
          }
        }

        if (nome === "p") {
          const dentro =
            !exigirContainer ||
            (profundidadeContainer !== -1 && profundidade > profundidadeContainer);
          if (dentro) {
            dentroDeP = true;
            atual = "";
          }
        }
      },

      ontext(texto) {
        if (dentroDeP && ignorandoAte === -1) atual += texto;
      },

      onclosetag(nome) {
        if (ignorandoAte === profundidade) ignorandoAte = -1;

        if (nome === "p" && dentroDeP) {
          const limpo = normalizar(atual);
          if (limpo.length >= MIN_CHARS_PARAGRAFO) paragrafos.push(limpo);
          dentroDeP = false;
          atual = "";
        }
        if (profundidade === profundidadeContainer) profundidadeContainer = -1;

        profundidade--;
      },
    },
    { decodeEntities: true },
  );

  parser.write(html);
  parser.end();

  if (paragrafos.length === 0) return null;

  return {
    texto: paragrafos.join("\n\n"),
    paragrafos: paragrafos.length,
    porContainer: exigirContainer,
  };
}

function normalizar(bruto: string): string {
  return bruto
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
