import { getCategoriaOuPadrao, type Tom } from "@/lib/categories";
import { LIMITES, medirIdioma } from "@/services/translation/guardrails";

/**
 * Geração do card visual (1080×1350 JPEG) e da legenda para o feed do Instagram.
 *
 * Inclui higienização tipográfica PT-BR, prevenção de corte de caracteres nos
 * selos do Cloudinary, deduplicação de resumo (para o corpo não repetir o dek)
 * e validação determinística contra vazamentos de HTML/Markdown/inglês.
 */

export interface ArtigoInstagram {
  id: string;
  slug: string;
  title: string | null;
  sourceTitle: string;
  dek: string | null;
  bodyMd: string | null;
  categorySlug: string;
  sourceName: string;
  imageUrl: string | null;
  imageCaption: string | null;
}

const COR_POR_TOM: Record<Tom, string> = {
  blue: "1d4ed8",
  green: "15803d",
  amber: "b45309",
  red: "b91c1c",
  neut: "3f3f46",
};

const HASHTAGS_BASE_VIRAIS = [
  "#MinutoCatolico",
  "#IgrejaCatolica",
  "#Catolicos",
  "#Catolicismo",
  "#FeCatolica",
  "#NoticiasCatolicas",
] as const;

const HASHTAGS_POR_CATEGORIA: Record<string, readonly string[]> = {
  vaticano: [
    "#Vaticano",
    "#SantaSe",
    "#Roma",
    "#Papa",
    "#Magisterio",
    "#PapaLeaoXIV",
  ],
  liturgia: [
    "#Liturgia",
    "#SantaMissa",
    "#Eucaristia",
    "#TradicaoCatolica",
    "#MissaTradicional",
    "#fsspx",
  ],
  santos: [
    "#SantoDoDia",
    "#SantosCatolicos",
    "#VidaDosSantos",
    "#Santidade",
    "#Oracao",
  ],
  opiniao: [
    "#FormacaoCatolica",
    "#Apologetica",
    "#DoutrinaCatolica",
    "#criseNaIgreja",
    "#VaticanoSegundo",
  ],
  patrimonio: [
    "#ArteSacra",
    "#PatrimonioCatolico",
    "#HistoriaDaIgreja",
    "#CulturaCatolica",
  ],
  caridade: [
    "#Caridade",
    "#DoutrinaSocial",
    "#Misericordia",
    "#AmorAoProximo",
  ],
  juventude: [
    "#JuventudeCatolica",
    "#JovensCatolicos",
    "#Vocacao",
    "#SerCatolico",
  ],
  missoes: [
    "#Evangelizacao",
    "#Missoes",
    "#MissaoCatolica",
    "#AnuncioDoEvangelho",
  ],
  doutrina: [
    "#DoutrinaCatolica",
    "#Catecismo",
    "#TeologiaCatolica",
    "#FormacaoCatolica",
    "#VerdadeCatolica",
  ],
  brasil: [
    "#IgrejaNoBrasil",
    "#CatolicosBrasil",
    "#CatolicosDoBrasil",
    "#BrasilCatolico",
    "#NossaSenhoraAparecida",
  ],
  mundo: [
    "#IgrejaNoMundo",
    "#CristaosNoMundo",
    "#LiberdadeReligiosa",
    "#CatolicosDoBrasil",
  ],
};

const REGRAS_HASHTAGS_CONTEXTO: ReadonlyArray<{
  padrao: RegExp;
  tags: readonly string[];
}> = [
  {
    padrao: /\bpap[ao]\b|le[aã]o\s*xiv|leo\s*xiv|pont[ií]fice|santo padre/i,
    tags: ["#PapaLeaoXIV", "#Vaticano"],
  },
  {
    padrao: /eucarist|missa|altar|sacrament|sant[ií]ssimo/i,
    tags: ["#Eucaristia", "#SantaMissa"],
  },
  {
    padrao:
      /virgem maria|nossa senhora|mariano|aparecida|f[aá]tima|lourdes|ros[aá]rio/i,
    tags: ["#NossaSenhora", "#VirgemMaria"],
  },
  {
    padrao: /ora[cç][aã]o|ter[cç]o|jejum|quaresma|advento|p[aá]scoa|natal/i,
    tags: ["#Oracao", "#VidaDeOracao"],
  },
  {
    padrao: /tridentin|traditionis|lefebvre|fsspx|missa antiga|latim/i,
    tags: ["#TradicaoCatolica", "#MissaTradicional", "#fsspx"],
  },
  {
    padrao: /ab[oó]rto|pr[oó]-vida|fam[ií]lia|casamento|matrim[oô]nio|m[aã]e/i,
    tags: ["#FamiliaCatolica", "#ProVida"],
  },
  {
    padrao: /bispo|cardeal|diocese|arquidiocese|cnbb|seminarista|sacerdote|padre/i,
    tags: ["#Clero", "#OracaoPelosPadres"],
  },
];

const MAX_HASHTAGS_POST = 14;

/**
 * Monta um bloco de hashtags católicas em português de alto alcance combinando
 * identidade do portal, editoria e contexto temático da manchete/resumo.
 */
export function montarHashtagsInstagram(
  artigo: Pick<
    ArtigoInstagram,
    "categorySlug" | "title" | "sourceTitle" | "dek"
  >,
): string {
  const resultado: string[] = [];
  const vistas = new Set<string>();

  const adicionar = (tag: string) => {
    if (resultado.length >= MAX_HASHTAGS_POST) return;
    const chave = tag.toLowerCase();
    if (vistas.has(chave)) return;
    vistas.add(chave);
    resultado.push(tag);
  };

  for (const tag of HASHTAGS_BASE_VIRAIS) adicionar(tag);

  const daCategoria =
    HASHTAGS_POR_CATEGORIA[artigo.categorySlug] ?? HASHTAGS_POR_CATEGORIA.mundo;
  for (const tag of daCategoria) adicionar(tag);

  const textoAnalise = `${artigo.title ?? artigo.sourceTitle} ${artigo.dek ?? ""}`;
  for (const regra of REGRAS_HASHTAGS_CONTEXTO) {
    if (regra.padrao.test(textoAnalise)) {
      for (const tag of regra.tags) adicionar(tag);
    }
  }

  return resultado.join(" ");
}

const MAX_CARACTERES_LEGENDA = 2_200;
const MAX_CARACTERES_MANCHETE_CARD = 98;
const MAX_CARACTERES_TRECHO_LEGENDA = 360;

/**
 * Espaço não-quebrável (`\u00A0`) usado ao redor do rótulo da editoria para que
 * o Cloudinary não corte a primeira/última letra com bordas arredondadas.
 */
const PADDING_SELO = "\u00A0\u00A0";

const PREPOSICOES_SOLTAS = new Set([
  "a", "as", "o", "os", "ao", "aos", "à", "às",
  "de", "da", "das", "do", "dos", "e", "ou",
  "em", "na", "nas", "no", "nos", "para", "por",
  "com", "sem", "sob", "sobre", "entre", "após",
  "contra", "um", "uma", "uns", "umas", "que",
]);

const ENTIDADES_HTML: Readonly<Record<string, string>> = {
  amp: "&",
  nbsp: " ",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  laquo: '"',
  raquo: '"',
};

export function toBase64Url(texto: string): string {
  const bytes = new TextEncoder().encode(texto);
  let binario = "";
  for (const byte of bytes) {
    binario += String.fromCharCode(byte);
  }
  return btoa(binario)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

/**
 * Escapa textos em português para camadas `l_text` do Cloudinary.
 *
 * Vírgulas e barras separam parâmetros de transformação no Cloudinary, portanto
 * exigem double-encoding (`%25` -> `%2525`, `%2C` -> `%252C`, `%2F` -> `%252F`).
 */
export function escaparTextoCloudinary(texto: string): string {
  const estrito = encodeURIComponent(texto).replace(
    /[!'()*]/g,
    (caractere) => `%${caractere.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return estrito
    .replace(/%25/g, "%2525")
    .replace(/%2C/g, "%252C")
    .replace(/%2F/g, "%252F");
}

function decodificarEntidades(texto: string): string {
  return texto.replace(
    /&(#x?[0-9a-f]+|[a-z]+);/gi,
    (match, codigo: string) => {
      const lower = codigo.toLowerCase();
      if (lower in ENTIDADES_HTML) return ENTIDADES_HTML[lower]!;
      if (lower.startsWith("#x")) {
        const n = Number.parseInt(lower.slice(2), 16);
        return Number.isFinite(n) && n > 0 ? String.fromCodePoint(n) : match;
      }
      if (lower.startsWith("#")) {
        const n = Number.parseInt(lower.slice(1), 10);
        return Number.isFinite(n) && n > 0 ? String.fromCodePoint(n) : match;
      }
      return match;
    },
  );
}

/**
 * Limpa Markdown, entidades HTML, caracteres invisíveis e falhas comuns de
 * espaçamento e pontuação em português.
 */
export function higienizarTextoEditorial(bruto: string): string {
  let texto = decodificarEntidades(bruto)
    .replace(/[\u200B-\u200D\uFEFF\uFFFD]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s*/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");

  // Colapsa quebras e espaços múltiplos mantendo espaços regulares.
  texto = texto.replace(/\s+/g, " ").trim();

  // Corrige espaço indevido antes de pontuação (ex.: "Roma , ontem" -> "Roma, ontem").
  texto = texto.replace(/\s+([,.;:!?])/g, "$1");

  // Garante espaço após pontuação quando colada em letra (preserva decimais como 1,5).
  texto = texto.replace(/([,;!?])([\p{L}])/gu, "$1 $2");

  // Garante primeira letra maiúscula quando iniciar por minúscula (respeita aspas iniciais).
  texto = texto.replace(
    /^(["']?\s*)(\p{Ll})/u,
    (_, prefixo: string, letra: string) => `${prefixo}${letra.toUpperCase()}`,
  );

  return texto.trim();
}

/**
 * Corta uma manchete respeitando palavras inteiras e removendo conectivos/artigos
 * soltos no fim (evita cards como "Bispo comenta sobre a…").
 */
export function truncarMancheteCard(texto: string, maximo = MAX_CARACTERES_MANCHETE_CARD): string {
  const limpo = higienizarTextoEditorial(texto).replace(/\.+$/g, "").trim();
  if (limpo.length <= maximo) return limpo;

  const corte = limpo.slice(0, maximo - 1);
  const ultimoEspaco = corte.lastIndexOf(" ");
  let base = (ultimoEspaco > maximo * 0.5 ? corte.slice(0, ultimoEspaco) : corte)
    .replace(/[,;:\-–—]+$/g, "")
    .trim();

  // Remove conectivos soltos no fim do corte até sobrar substantivo/verbo forte.
  const palavras = base.split(" ");
  while (palavras.length > 3) {
    const ultima = palavras[palavras.length - 1]!.toLowerCase();
    if (!PREPOSICOES_SOLTAS.has(ultima)) break;
    palavras.pop();
  }
  base = palavras.join(" ").replace(/[,;:\-–—]+$/g, "").trim();

  return `${base}…`;
}

function truncarPorFraseCompleta(texto: string, maximo: number): string {
  const limpo = higienizarTextoEditorial(texto);
  if (limpo.length <= maximo) return limpo;

  const janela = limpo.slice(0, maximo);
  const frases = [...janela.matchAll(/[.!?]["']?(?=\s|$)/g)];
  const ultimaFrase = frases[frases.length - 1];
  if (ultimaFrase && ultimaFrase.index !== undefined && ultimaFrase.index >= 90) {
    return janela.slice(0, ultimaFrase.index + ultimaFrase[0].length).trim();
  }

  return truncarMancheteCard(limpo, maximo);
}

function palavrasSignificativas(texto: string): Set<string> {
  const normalizado = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return new Set(
    (normalizado.match(/[a-z]{4,}/g) ?? []),
  );
}

function sobreposicaoLexical(a: string, b: string): number {
  const conjA = palavrasSignificativas(a);
  const conjB = palavrasSignificativas(b);
  if (conjA.size === 0 || conjB.size === 0) return 0;
  let comuns = 0;
  for (const p of conjA) {
    if (conjB.has(p)) comuns += 1;
  }
  return comuns / Math.min(conjA.size, conjB.size);
}

function extrairTrechoComplementar(
  bodyMd: string | null,
  dek: string,
): string {
  if (!bodyMd) return "";
  const blocos = bodyMd
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(
      (b) =>
        b.length > 0 &&
        !b.startsWith("#") &&
        !/^>\s*\*?\*?Fontes?:/i.test(b),
    )
    .map((b) => higienizarTextoEditorial(b))
    .filter((b) => b.length >= 45);

  for (const candidato of blocos) {
    if (dek && sobreposicaoLexical(dek, candidato) >= 0.45) {
      continue;
    }
    return truncarPorFraseCompleta(candidato, MAX_CARACTERES_TRECHO_LEGENDA);
  }

  return "";
}

function garantirPontuacaoFinal(texto: string): string {
  if (!texto) return texto;
  return /[.!?…"]$/.test(texto) ? texto : `${texto}.`;
}

/**
 * Monta a legenda para o feed do Instagram com título limpo, breve resumo sem
 * repetição redundante, atribuição da fonte, CTA `/bio` e hashtags segmentadas.
 */
export function montarLegendaInstagram(
  artigo: ArtigoInstagram,
  siteUrl: string,
): string {
  const titulo = higienizarTextoEditorial(artigo.title ?? artigo.sourceTitle).replace(
    /\.+$/g,
    "",
  );
  const dekBruto = artigo.dek ? higienizarTextoEditorial(artigo.dek) : "";
  const dek = dekBruto ? garantirPontuacaoFinal(dekBruto) : "";
  const trechoCorpo = extrairTrechoComplementar(artigo.bodyMd, dek);
  const dominio = siteUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "");

  const partes: string[] = [titulo];

  if (dek) {
    partes.push(dek);
  }

  if (trechoCorpo) {
    partes.push(garantirPontuacaoFinal(trechoCorpo));
  }

  partes.push(
    `Fonte original: ${artigo.sourceName}`,
    `Comente LER ou LINK para receber a matéria no Direct, ou acesse pelo link da bio (${dominio}/bio).`,
    montarHashtagsInstagram(artigo),
  );

  const legenda = partes.join("\n\n");
  return legenda.length <= MAX_CARACTERES_LEGENDA
    ? legenda
    : truncarPorFraseCompleta(legenda, MAX_CARACTERES_LEGENDA);
}

/**
 * Valida antes de enviar à Cloudinary/Meta que todos os textos visíveis no card
 * e na legenda estão em português limpo, sem fragmentos em inglês, tags HTML ou
 * caracteres corrompidos.
 */
export function validarTextosParaInstagram(
  artigo: ArtigoInstagram,
  siteUrl: string,
): { ok: true; legenda: string } | { ok: false; motivo: string } {
  if (!artigo.title || !artigo.dek) {
    return { ok: false, motivo: "artigo sem título ou resumo adaptado em PT-BR" };
  }

  const tituloLimpo = higienizarTextoEditorial(artigo.title);
  const dekLimpo = higienizarTextoEditorial(artigo.dek);

  if (tituloLimpo.length < 15 || dekLimpo.length < 30) {
    return { ok: false, motivo: "título ou resumo curto demais após higienização" };
  }

  const amostra = `${tituloLimpo}. ${dekLimpo}`;
  if (/https?:\/\/|<\/?[a-z][^>]*>|&[a-z#0-9]+;|\uFFFD/i.test(amostra)) {
    return { ok: false, motivo: "resíduo de URL, HTML ou codificação quebrada no texto" };
  }

  const idioma = medirIdioma(amostra);
  if (idioma.razaoEn > LIMITES.MAX_RAZAO_STOPWORDS_EN) {
    return {
      ok: false,
      motivo: `texto aparenta estar em inglês (razão=${idioma.razaoEn.toFixed(2)})`,
    };
  }

  return { ok: true, legenda: montarLegendaInstagram(artigo, siteUrl) };
}

/**
 * Constrói a URL dinâmica no Cloudinary que gera um card editorial `1080×1350`
 * (proporção 4:5) em JPEG baseline (`fl_progressive:none`) exigido pela Meta.
 *
 * O selo da categoria usa `\u00A0\u00A0` + `r_10` para manter margem horizontal
 * folgada e impedir qualquer corte nas letras iniciais/finais (ex.: "IGREJA").
 */
export function montarUrlCardInstagram({
  cloudName,
  siteUrl,
  artigo,
}: {
  cloudName: string;
  siteUrl: string;
  artigo: ArtigoInstagram;
}): string {
  const baseAssets = siteUrl.replace(/\/+$/, "");
  const overlayUrl = `${baseAssets}/social/overlay-instagram.png`;
  const fallbackBgUrl = `${baseAssets}/social/bg-editorial.jpg`;

  const categoria = getCategoriaOuPadrao(artigo.categorySlug);
  const cor = COR_POR_TOM[categoria.tom];
  const labelCategoria = `${PADDING_SELO}${categoria.label.toUpperCase()}${PADDING_SELO}`;

  const tituloBruto = artigo.title ?? artigo.sourceTitle;
  const manchete = truncarMancheteCard(tituloBruto, MAX_CARACTERES_MANCHETE_CARD);
  const tamanhoFonte =
    manchete.length <= 55 ? 50 : manchete.length <= 80 ? 46 : 42;

  const urlFotoBase = artigo.imageUrl?.trim() || fallbackBgUrl;
  const cropBase = artigo.imageUrl?.trim()
    ? "w_1080,h_1350,c_fill,g_auto"
    : "w_1080,h_1350,c_fill";

  const camadaOverlay = `l_fetch:${toBase64Url(overlayUrl)}/fl_layer_apply,w_1080,h_1350,g_center`;
  const camadaSelo = `bo_10px_solid_rgb:${cor},b_rgb:${cor},r_10,co_white,l_text:Montserrat@google_24_700_letter_spacing_2:${escaparTextoCloudinary(labelCategoria)}/fl_layer_apply,g_north_east,x_72,y_62`;
  const camadaManchete = `w_900,c_fit,co_white,l_text:Montserrat@google_${tamanhoFonte}_700_line_spacing_4:${escaparTextoCloudinary(manchete)}/fl_layer_apply,g_south_west,x_72,y_182`;
  const formatoSaida = "f_jpg,fl_progressive:none,q_88";

  // Evita que `?` ou `#` da URL de origem interfira na rota `/image/fetch/`.
  const destinoRemoto = urlFotoBase
    .replace(/\?/g, "%3F")
    .replace(/#/g, "%23");

  return [
    `https://res.cloudinary.com/${encodeURIComponent(cloudName)}/image/fetch`,
    cropBase,
    camadaOverlay,
    camadaSelo,
    camadaManchete,
    formatoSaida,
    destinoRemoto,
  ].join("/");
}

/**
 * Constrói a URL dinâmica no Cloudinary que gera um Story `1080×1920` (9:16)
 * em JPEG baseline com zona segura para UI do Instagram, manchete e chamada
 * para recebimento do link clicável via Direct ("Responda LER") ou bio.
 */
export function montarUrlStoryInstagram({
  cloudName,
  siteUrl,
  artigo,
}: {
  cloudName: string;
  siteUrl: string;
  artigo: ArtigoInstagram;
}): string {
  const baseAssets = siteUrl.replace(/\/+$/, "");
  const overlayStoryUrl = `${baseAssets}/social/overlay-story.png`;
  const fallbackBgStoryUrl = `${baseAssets}/social/bg-editorial-story.jpg`;

  const categoria = getCategoriaOuPadrao(artigo.categorySlug);
  const cor = COR_POR_TOM[categoria.tom];
  const labelCategoria = `${PADDING_SELO}${categoria.label.toUpperCase()}${PADDING_SELO}`;

  const tituloBruto = artigo.title ?? artigo.sourceTitle;
  const manchete = truncarMancheteCard(tituloBruto, MAX_CARACTERES_MANCHETE_CARD);
  const tamanhoFonte =
    manchete.length <= 55 ? 54 : manchete.length <= 80 ? 48 : 44;

  const urlFotoBase = artigo.imageUrl?.trim() || fallbackBgStoryUrl;
  const cropBase = artigo.imageUrl?.trim()
    ? "w_1080,h_1920,c_fill,g_auto"
    : "w_1080,h_1920,c_fill";

  const camadaOverlay = `l_fetch:${toBase64Url(overlayStoryUrl)}/fl_layer_apply,w_1080,h_1920,g_center`;
  const camadaSelo = `bo_10px_solid_rgb:${cor},b_rgb:${cor},r_10,co_white,l_text:Montserrat@google_24_700_letter_spacing_2:${escaparTextoCloudinary(labelCategoria)}/fl_layer_apply,g_north_east,x_72,y_270`;
  const camadaManchete = `w_936,c_fit,co_white,l_text:Montserrat@google_${tamanhoFonte}_700_line_spacing_6:${escaparTextoCloudinary(manchete)}/fl_layer_apply,g_south_west,x_72,y_560`;
  const formatoSaida = "f_jpg,fl_progressive:none,q_88";

  const destinoRemoto = urlFotoBase
    .replace(/\?/g, "%3F")
    .replace(/#/g, "%23");

  return [
    `https://res.cloudinary.com/${encodeURIComponent(cloudName)}/image/fetch`,
    cropBase,
    camadaOverlay,
    camadaSelo,
    camadaManchete,
    formatoSaida,
    destinoRemoto,
  ].join("/");
}
