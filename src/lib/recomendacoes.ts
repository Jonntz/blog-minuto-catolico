/**
 * Catálogo curado de leituras espirituais e litúrgicas recomendadas por tema.
 *
 * 100% Server-Side, sem scripts externos, sem cookies de rastreamento e com
 * CLS = 0. Quando uma tag de afiliado da Amazon Associados (ex.: `AMAZON_PARTNER_TAG`)
 * for definida, basta preenchê-la em `TAG_AFILIADO_AMAZON` para monetizar cada
 * indicação mantendo conformidade integral com a LGPD e o Google News.
 */

export const TAG_AFILIADO_AMAZON = "";

export interface ObraRecomendada {
  titulo: string;
  autor: string;
  motivo: string;
  termoBuscaAmazon: string;
  categorias: readonly string[];
}

const CATALOGO: readonly ObraRecomendada[] = [
  {
    titulo: "Missal Romano Quotidiano (Latim–Português · Rito de 1962)",
    autor: "Dom Gaspar Lefebvre",
    motivo:
      "O missal clássico para acompanhar o Ordinário e o Próprio de cada dia na Missa Tridentina, com explicações litúrgicas e devocionais.",
    termoBuscaAmazon: "Missal Quotidiano Dom Gaspar Lefebvre",
    categorias: ["liturgia"],
  },
  {
    titulo: "Catecismo Maior de São Pio X",
    autor: "Papa São Pio X",
    motivo:
      "Síntese clara, direta e segura da doutrina católica em perguntas e respostas, escrita para a formação sólida dos fiéis.",
    termoBuscaAmazon: "Catecismo Maior Sao Pio X",
    categorias: ["doutrina", "juventude"],
  },
  {
    titulo: "Imitação de Cristo",
    autor: "Tomás de Kempis",
    motivo:
      "Depois da Sagrada Escritura, o clássico espiritual mais lido da cristandade sobre vida interior, humildade e exame de consciência.",
    termoBuscaAmazon: "Imitacao de Cristo Tomas de Kempis",
    categorias: ["santos", "opiniao"],
  },
  {
    titulo: "História de uma Alma",
    autor: "Santa Teresinha do Menino Jesus",
    motivo:
      "Autobiografia espiritual da Padroeira Universal das Missões e Doutora da Igreja sobre a Pequena Via da infância espiritual.",
    termoBuscaAmazon: "Historia de uma Alma Santa Teresinha",
    categorias: ["missoes", "caridade"],
  },
  {
    titulo: "Catecismo Romano (Catecismo do Concílio de Trento)",
    autor: "Igreja Católica",
    motivo:
      "O monumento doutrinário promulgado por São Pio V para a exposição fiel do Credo, dos Sacramentos, do Decálogo e da Oração.",
    termoBuscaAmazon: "Catecismo Romano Concilio de Trento",
    categorias: ["vaticano", "mundo", "patrimonio", "brasil"],
  },
];

export function escolherObraPorCategoria(categoriaSlug: string): ObraRecomendada {
  return (
    CATALOGO.find((o) => o.categorias.includes(categoriaSlug)) ?? CATALOGO[0]!
  );
}

export function urlBuscaAmazon(obra: ObraRecomendada): string {
  const params = new URLSearchParams({
    k: obra.termoBuscaAmazon,
    i: "stripbooks",
  });
  if (TAG_AFILIADO_AMAZON) {
    params.set("tag", TAG_AFILIADO_AMAZON);
  }
  return `https://www.amazon.com.br/s?${params.toString()}`;
}
