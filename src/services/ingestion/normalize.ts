/**
 * Normalização do material bruto das fontes: HTML → texto, data → unix, corte
 * de texto sem cortar palavra ao meio.
 */

import { Parser } from "htmlparser2";

/** Nunca contribuem com texto legível. */
const TAGS_IGNORADAS = new Set(["script", "style", "noscript", "iframe", "svg", "template"]);

/** Fecham/abrem parágrafo — viram quebra de linha para o texto não colar. */
const TAGS_BLOCO = new Set([
  "p", "div", "br", "hr", "li", "ul", "ol", "tr", "td", "th", "table",
  "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "section", "article",
  "header", "footer", "figure", "figcaption", "pre",
]);

/**
 * HTML → texto puro.
 *
 * Usa `htmlparser2` (streaming, sem DOM) em vez de regex: o `content:encoded`
 * do EWTN vem com links, `<strong>` e entidades, e um `replace(/<[^>]*>/g)`
 * quebraria em qualquer atributo com `>` dentro. Também é o único parser de HTML
 * do projeto que roda em Workers sem `nodejs_compat` pesado (CLAUDE.md §8).
 */
export function htmlParaTexto(html: string): string {
  const partes: string[] = [];
  let ignorando = 0;

  const parser = new Parser(
    {
      onopentag(nome) {
        if (TAGS_IGNORADAS.has(nome)) ignorando++;
        else if (TAGS_BLOCO.has(nome)) partes.push("\n");
      },
      ontext(texto) {
        if (ignorando === 0) partes.push(texto);
      },
      onclosetag(nome) {
        if (TAGS_IGNORADAS.has(nome)) {
          if (ignorando > 0) ignorando--;
        } else if (TAGS_BLOCO.has(nome)) {
          partes.push("\n");
        }
      },
    },
    { decodeEntities: true },
  );

  parser.write(html);
  parser.end();

  return partes
    .join("")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/ *\n *(?:\n *)+/g, "\n\n")
    .replace(/ *\n */g, "\n")
    .trim();
}

/** Texto que pode ou não conter HTML — resolve os dois casos. */
export function textoLimpo(bruto: string | undefined): string | undefined {
  if (!bruto) return undefined;
  const texto = /<[a-z!/]/i.test(bruto) ? htmlParaTexto(bruto) : bruto.trim();
  return texto || undefined;
}

/** Janela de sanidade para datas: nada antes de 2000 nem muito no futuro. */
const MINIMO_UNIX = 946_684_800; // 2000-01-01
const FOLGA_FUTURO_S = 2 * 24 * 60 * 60;

/**
 * `pubDate` (RFC 822) → unix em SEGUNDOS, como exige o schema.
 *
 * Data inválida cai no `agora`: um item sem data válida ainda é notícia, e
 * perder a matéria é pior que datá-la com alguns minutos de erro. Data absurda
 * (fonte com relógio quebrado) também é normalizada, senão o item vira o
 * primeiro do feed para sempre.
 */
export function paraUnixSegundos(pubDate: string | undefined, agora: number): number {
  if (!pubDate) return agora;

  const ms = Date.parse(pubDate);
  if (!Number.isFinite(ms)) return agora;

  const segundos = Math.floor(ms / 1000);
  if (segundos < MINIMO_UNIX) return agora;
  if (segundos > agora + FOLGA_FUTURO_S) return agora;
  return segundos;
}

/** Corte em fronteira de palavra, com reticências. */
export function truncar(texto: string, maximo: number): string {
  if (texto.length <= maximo) return texto;
  const cortado = texto.slice(0, maximo);
  const ultimoEspaco = cortado.lastIndexOf(" ");
  const base = ultimoEspaco > maximo * 0.6 ? cortado.slice(0, ultimoEspaco) : cortado;
  return `${base.replace(/[\s.,;:—-]+$/, "")}…`;
}

/**
 * Remove o sufixo de marca que o WordPress cola no `og:title`
 * (ex.: "Título da matéria | Sign of the Cross Media").
 */
export function semSufixoDeMarca(titulo: string, marca: string): string {
  const sufixos = [` | ${marca}`, ` - ${marca}`, ` – ${marca}`];
  for (const sufixo of sufixos) {
    if (titulo.endsWith(sufixo)) return titulo.slice(0, -sufixo.length).trim();
  }
  return titulo.trim();
}
