/**
 * Geração de slug para as URLs do portal.
 *
 * O slug é NOT NULL e UNIQUE no schema, então a ingestão precisa gerar um já na
 * entrada — mesmo antes de existir título em PT-BR. A adaptação (fase C) pode
 * reescrevê-lo a partir do título traduzido; até lá, o slug derivado do título
 * da fonte mantém a linha do banco válida e endereçável.
 */

const TAMANHO_MAXIMO = 80;

/**
 * Texto → slug ASCII.
 *
 * Aspas tipográficas (’ “ ”) aparecem MUITO nos títulos do EWTN; se virassem
 * hífen, todo slug ficaria cheio de separadores soltos. Por isso elas são
 * apagadas, não substituídas.
 */
export function gerarSlug(texto: string, maximo = TAMANHO_MAXIMO): string {
  const base = texto
    .normalize("NFD")
    // Remove marcas diacríticas combinantes (acentos) após a decomposição.
    .replace(/[\u0300-\u036f]/g, "")
    // Apóstrofos e aspas somem sem deixar separador.
    .replace(/['‘’“”ʼ`]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!base) return "";
  if (base.length <= maximo) return base;

  // Corta na fronteira de palavra mais próxima, para não terminar no meio dela.
  const cortado = base.slice(0, maximo);
  const ultimoHifen = cortado.lastIndexOf("-");
  const final = ultimoHifen > maximo * 0.5 ? cortado.slice(0, ultimoHifen) : cortado;
  return final.replace(/-+$/, "");
}

/**
 * Slug com sufixo de desambiguação.
 *
 * Usado quando o UNIQUE de `articles.slug` reprova o insert: duas matérias
 * diferentes podem ter títulos que colapsam no mesmo slug (frequente em
 * manchetes curtas tipo "Pope Leo XIV visits Assisi").
 */
export function slugDesambiguado(base: string, sufixo: string): string {
  const limpo = gerarSlug(base, TAMANHO_MAXIMO - sufixo.length - 1);
  return limpo ? `${limpo}-${sufixo}` : `noticia-${sufixo}`;
}

/** Slug de emergência quando o título não produz nada aproveitável. */
export function slugDeFallback(sufixo: string): string {
  return `noticia-${sufixo}`;
}
