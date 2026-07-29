/**
 * Extração de meta tags Open Graph da página de um artigo.
 *
 * Existe por causa do Sign of the Cross: o feed deles não traz `content:encoded`
 * nem imagem nenhuma, e a WP REST API responde 401 (verificado em 27/07/2026).
 * A única forma de obter imagem e uma descrição decente é ler o `<head>` da
 * página — que tem `og:image` e `og:description`.
 *
 * `htmlparser2` em modo streaming, sem DOM: roda em Workers e não carrega o
 * documento inteiro em memória como fariam `cheerio`/`jsdom` (CLAUDE.md §8).
 */

import { Parser } from "htmlparser2";

export interface MetaOpenGraph {
  titulo?: string;
  descricao?: string;
  imagem?: string;
  autor?: string;
  publicadoEm?: string;
}

/** Nomes aceitos por chave, em ordem de preferência. */
const CHAVES: Readonly<Record<keyof MetaOpenGraph, readonly string[]>> = {
  titulo: ["og:title", "twitter:title"],
  descricao: ["og:description", "twitter:description", "description"],
  imagem: ["og:image", "og:image:secure_url", "twitter:image"],
  autor: ["article:author", "author"],
  publicadoEm: ["article:published_time"],
};

/**
 * Só o `<head>` interessa, e ele é o começo do documento.
 *
 * Cortar aqui não é micro-otimização: uma página do WordPress tem ~100 KB, e o
 * `<head>` costuma ser 5% disso. Numa execução que lê 12 artigos, a diferença
 * aparece no tempo de CPU do Worker — que é o recurso escasso.
 */
function recortarCabecalho(html: string): string {
  const fim = html.search(/<\/head\s*>/i);
  return fim >= 0 ? html.slice(0, fim) : html.slice(0, 200_000);
}

export function extrairOpenGraph(html: string): MetaOpenGraph {
  const encontradas = new Map<string, string>();

  const parser = new Parser(
    {
      onopentag(nome, atributos) {
        if (nome !== "meta") return;
        // OG usa `property`; `description`/`author` clássicos usam `name`.
        const chave = (atributos.property ?? atributos.name ?? "").toLowerCase();
        const conteudo = atributos.content?.trim();
        if (!chave || !conteudo) return;
        // Primeira ocorrência vence: WordPress às vezes repete og:image por tamanho.
        if (!encontradas.has(chave)) encontradas.set(chave, conteudo);
      },
    },
    { decodeEntities: true },
  );

  parser.write(recortarCabecalho(html));
  parser.end();

  const resultado: MetaOpenGraph = {};
  for (const [campo, nomes] of Object.entries(CHAVES) as [
    keyof MetaOpenGraph,
    readonly string[],
  ][]) {
    for (const nome of nomes) {
      const valor = encontradas.get(nome);
      if (valor) {
        resultado[campo] = valor;
        break;
      }
    }
  }

  return resultado;
}
