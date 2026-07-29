/**
 * Categorias editoriais — CONTRATO compartilhado.
 *
 * Consumido pela ingestão (mapeia categoria da fonte → slug), pelo design
 * (rótulo e cor das tags/chips) e pelo SEO (rotas e sitemap). Alterar aqui afeta
 * as três frentes; mudanças precisam de nota no MEMORY.md.
 *
 * Os `tone` vêm direto do design original ("Blog Notícias Católicas.dc.html",
 * objeto `chipTone` + as tags usadas nos cards). Não inventar cor nova: cada
 * tom já tem par -f/-b definido em globals.css.
 */

/** Tons disponíveis. Cada um vira o par text-{tom}-f / bg-{tom}-b. */
export const TONS = ["blue", "green", "amber", "red", "neut"] as const;
export type Tom = (typeof TONS)[number];

export interface Categoria {
  slug: string;
  /** Rótulo exibido, exatamente como no design. */
  label: string;
  tom: Tom;
  /** Aparece na navegação principal e no rodapé. */
  naNav: boolean;
  /** Aparece na régua de chips da home. */
  noChip: boolean;
}

export const CATEGORIAS: readonly Categoria[] = [
  { slug: "vaticano", label: "Vaticano", tom: "blue", naNav: true, noChip: true },
  {
    slug: "mundo",
    // Acrescentada na Fase 2. Sem ela, 74 de 75 artigos caíam em `vaticano`
    // porque `/world/*` do EWTN é GEOGRAFIA, não assunto — e "Vaticano" tem
    // significado editorial estrito (Santa Sé, Papa, Cúria). Pôr notícia do
    // Líbano ou da Nova Zelândia sob "Vaticano" é erro factual, não só de UX.
    label: "Igreja no Mundo",
    tom: "neut",
    naNav: false,
    noChip: true,
  },
  {
    slug: "brasil",
    // ATENÇÃO: hoje esta categoria não recebe conteúdo — EWTN e Sign of the
    // Cross cobrem EUA/mundo. Ver MEMORY.md §3. A UI deve esconder categoria
    // vazia em vez de mostrar uma seção morta.
    label: "Igreja no Brasil",
    tom: "neut",
    naNav: true,
    noChip: true,
  },
  { slug: "liturgia", label: "Liturgia", tom: "green", naNav: true, noChip: true },
  { slug: "santos", label: "Santos", tom: "amber", naNav: true, noChip: true },
  { slug: "opiniao", label: "Opinião", tom: "red", naNav: true, noChip: true },
  { slug: "patrimonio", label: "Patrimônio", tom: "amber", naNav: false, noChip: false },
  { slug: "caridade", label: "Caridade", tom: "red", naNav: false, noChip: true },
  { slug: "juventude", label: "Juventude", tom: "blue", naNav: false, noChip: true },
  { slug: "missoes", label: "Missões", tom: "green", naNav: false, noChip: true },
  { slug: "doutrina", label: "Doutrina", tom: "neut", naNav: false, noChip: true },
] as const;

export type SlugCategoria = (typeof CATEGORIAS)[number]["slug"];

/**
 * Fallback quando a fonte não dá pista suficiente.
 *
 * É `mundo`, não `vaticano`: chutar "Vaticano" para uma notícia sobre a Igreja
 * no Líbano seria afirmação factualmente errada, e o `CLAUDE.md` §1 trata
 * precisão como requisito de produto. "Igreja no Mundo" é verdadeiro para
 * qualquer notícia católica não identificada.
 */
export const CATEGORIA_PADRAO = "mundo";

const porSlug = new Map(CATEGORIAS.map((c) => [c.slug, c]));

export function getCategoria(slug: string): Categoria | undefined {
  return porSlug.get(slug);
}

export function getCategoriaOuPadrao(slug: string): Categoria {
  return porSlug.get(slug) ?? porSlug.get(CATEGORIA_PADRAO)!;
}

/** Classes Tailwind da tag, no par foreground/background do tom. */
export function classesTom(tom: Tom): string {
  const mapa: Record<Tom, string> = {
    blue: "text-blue-f bg-blue-b",
    green: "text-green-f bg-green-b",
    amber: "text-amber-f bg-amber-b",
    red: "text-red-f bg-red-b",
    neut: "text-neut-f bg-neut-b",
  };
  return mapa[tom];
}

/**
 * Categoria da fonte → slug interno. APENAS termos específicos.
 *
 * Termos genéricos ('Catholic Church', 'World', 'Faith', 'Catholic') foram
 * REMOVIDOS de propósito — ver `mapearCategoria` para o porquê.
 */
export const MAPA_CATEGORIA_FONTE: Readonly<Record<string, string>> = {
  vatican: "vaticano",
  vaticano: "vaticano",
  "holy see": "vaticano",
  pope: "vaticano",
  synod: "vaticano",

  liturgy: "liturgia",
  liturgia: "liturgia",
  mass: "liturgia",
  sacraments: "liturgia",
  eucharist: "liturgia",
  "latin mass": "liturgia",

  saints: "santos",
  saint: "santos",
  canonization: "santos",
  beatification: "santos",
  martyrs: "santos",

  opinion: "opiniao",
  editorial: "opiniao",
  commentary: "opiniao",
  column: "opiniao",
  analysis: "opiniao",

  charity: "caridade",
  "social justice": "caridade",
  poverty: "caridade",
  migrants: "caridade",
  immigration: "caridade",
  refugees: "caridade",
  "pro-life": "caridade",

  youth: "juventude",
  "world youth day": "juventude",
  students: "juventude",

  missions: "missoes",
  missionary: "missoes",
  evangelization: "missoes",
  persecution: "missoes",

  doctrine: "doutrina",
  catechism: "doutrina",
  theology: "doutrina",
  scripture: "doutrina",
  prayer: "doutrina",
  spirituality: "doutrina",
  devotion: "doutrina",

  heritage: "patrimonio",
  art: "patrimonio",
  architecture: "patrimonio",
  history: "patrimonio",
  cathedral: "patrimonio",

  brazil: "brasil",
  brasil: "brasil",
  cnbb: "brasil",
};

/**
 * Léxico de título — usado quando a categoria da fonte não decide.
 *
 * É indispensável na prática: 43 dos 50 itens do EWTN vêm sob `/world/*`, que é
 * recorte GEOGRÁFICO. Sem olhar o título, tudo isso viraria um balde só.
 *
 * Termos em minúsculas e sem acento (o título é normalizado antes de comparar).
 * A ordem dentro de cada categoria não importa; entre categorias, ganha quem
 * tiver mais acertos, e o desempate segue a ordem deste objeto.
 */
const LEXICO_TITULO: Readonly<Record<string, readonly string[]>> = {
  santos: [
    "beatif", "canoniz", "saint ", "st. ", "martyr", "relic",
    "miracle", "venerable", "servant of god", "blessed ",
  ],
  vaticano: [
    "pope ", "vatican", "holy see", "pontiff", "papal", "synod", "curia",
    "encyclical", "consistory", "conclave", "dicastery", "nuncio",
  ],
  liturgia: [
    "mass", "liturg", "eucharist", "communion", "missal", "vespers",
    "sacrament", "baptism", "confession", "adoration", "holy hour",
    "advent", "lent", "easter vigil",
  ],
  caridade: [
    // "abuse" saiu daqui de propósito: cobertura de escândalo de abuso não é
    // "Caridade". Rotular assim seria eufemismo editorial — o pior tipo de erro
    // num portal católico. Sem categoria adequada, cai em "Igreja no Mundo".
    "migrant", "refugee", "immigra", "poverty", "poor", "hunger", "famine",
    "charity", "caritas", "trafficking", "homeless", "asylum",
    "pro-life", "abortion", "euthanasia", "deport",
  ],
  patrimonio: [
    "cathedral", "basilica", "restor", "fresco", "mosaic", "architect",
    "museum", "manuscript", "artifact", "century-old", "unveiled",
    "mural", "baroque", "renaissance", "stained glass", "shrine", "abbey",
  ],
  juventude: [
    "youth", "young catholic", "student", "campus", "seminarian",
    "vocation", "world youth day", "scout",
  ],
  missoes: [
    "mission", "evangeliz", "persecut", "missionar", "catechist",
    "church in africa", "church in asia",
  ],
  doutrina: [
    "catechism", "doctrin", "theolog", "scripture", "bible", "encyclical",
    "prayer", "devotion", "spiritual", "book club", "explain",
  ],
  opiniao: [
    "opinion", "commentary", "essay", "reflection", "editorial",
    "expert says", "analysis",
  ],
};

/** Segmento inicial do path da URL → slug. Sinal mais confiável que existe. */
const MAPA_PATH: Readonly<Record<string, string>> = {
  vatican: "vaticano",
  saints: "santos",
  liturgy: "liturgia",
  opinion: "opiniao",
  commentary: "opiniao",
  episodes: "doutrina", // Sign of the Cross: áudio devocional/formativo.
};

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export interface PistasDeCategoria {
  /** Categorias como a fonte publicou. */
  categorias?: readonly string[];
  /** Título original (em inglês). */
  titulo?: string;
  /** URL canônica na fonte. */
  url?: string;
}

/**
 * Escolhe a categoria a partir de todas as pistas disponíveis.
 *
 * ## Por que não é mais "primeiro acerto vence"
 *
 * A versão anterior pegava a primeira categoria publicada e mapeava. Medido
 * contra 75 artigos reais, isso jogou **74 em `vaticano`** e deixou o site com
 * uma categoria só — navegação e chips do design viravam decoração.
 *
 * Duas causas, ambas de mapeamento e não de código:
 * 1. `world → vaticano`. Mas `/world/` do EWTN é geografia, não assunto.
 * 2. O Sign of the Cross abre quase toda lista com `Catholic Church`, e como
 *    vencia o primeiro acerto, as tags específicas que vêm depois na lista
 *    nunca eram alcançadas.
 *
 * ## Ordem de decisão (do sinal mais forte para o mais fraco)
 * 1. Segmento do path da URL — o editor da fonte escolheu essa seção.
 * 2. Categoria específica publicada — genéricas foram removidas do mapa.
 * 3. Léxico de título, por contagem de acertos.
 * 4. `mundo` como padrão honesto.
 */
export function mapearCategoria(pistas: PistasDeCategoria): string {
  // 1. Path da URL.
  if (pistas.url) {
    try {
      const segmentos = new URL(pistas.url).pathname
        .split("/")
        .filter(Boolean)
        .map(normalizar);
      for (const seg of segmentos.slice(0, 2)) {
        const acerto = MAPA_PATH[seg];
        if (acerto) return acerto;
      }
    } catch {
      // URL malformada: segue para os próximos sinais.
    }
  }

  // 2. Categoria específica publicada pela fonte.
  for (const bruta of pistas.categorias ?? []) {
    const acerto = MAPA_CATEGORIA_FONTE[normalizar(bruta).trim()];
    if (acerto) return acerto;
  }

  // 3. Léxico de título — vence quem tiver mais acertos.
  if (pistas.titulo) {
    const titulo = normalizar(pistas.titulo);
    let melhorSlug = "";
    let melhorPontos = 0;
    for (const [slug, termos] of Object.entries(LEXICO_TITULO)) {
      let pontos = 0;
      for (const termo of termos) if (titulo.includes(termo)) pontos++;
      if (pontos > melhorPontos) {
        melhorPontos = pontos;
        melhorSlug = slug;
      }
    }
    if (melhorSlug) return melhorSlug;
  }

  // 4. Padrão honesto.
  return CATEGORIA_PADRAO;
}
