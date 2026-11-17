import { getCategoriaOuPadrao, type Tom } from "@/lib/categories";

/**
 * Geração do card visual (1080×1350 JPEG) e da legenda para o feed do Instagram.
 *
 * Tudo aqui é puro e determinístico: nenhuma chamada extra de IA e 0 ms de
 * renderização de imagem no Worker (a composição roda na CDN gratuita do
 * Cloudinary usando as máscaras estáticas em `public/social/`).
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

const HASHTAGS_POR_CATEGORIA: Record<string, string> = {
  vaticano: "#MinutoCatolico #Vaticano #IgrejaCatolica #Papa #NoticiasCatolicas",
  liturgia: "#MinutoCatolico #Liturgia #MissaTradicional #TradicaoCatolica #IgrejaCatolica",
  santos: "#MinutoCatolico #Santos #VidaDosSantos #FeCatolica #IgrejaCatolica",
  opiniao: "#MinutoCatolico #FeCatolica #IgrejaCatolica #FormacaoCatolica",
  patrimonio: "#MinutoCatolico #PatrimonioCatolico #ArteSacra #IgrejaCatolica",
  caridade: "#MinutoCatolico #Caridade #DoutrinaSocial #IgrejaCatolica",
  juventude: "#MinutoCatolico #JuventudeCatolica #FeCatolica #IgrejaCatolica",
  missoes: "#MinutoCatolico #Missoes #Evangelizacao #IgrejaCatolica",
  doutrina: "#MinutoCatolico #DoutrinaCatolica #Catecismo #FormacaoCatolica",
  brasil: "#MinutoCatolico #IgrejaNoBrasil #CatolicosBrasil #IgrejaCatolica",
  mundo: "#MinutoCatolico #IgrejaNoMundo #NoticiasCatolicas #IgrejaCatolica",
};

const MAX_CARACTERES_LEGENDA = 2_200;
const MAX_CARACTERES_MANCHETE_CARD = 112;

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

function truncarEmPalavra(texto: string, maximo: number): string {
  const limpo = texto.replace(/\s+/g, " ").trim();
  if (limpo.length <= maximo) return limpo;
  const corte = limpo.slice(0, maximo - 1);
  const ultimoEspaco = corte.lastIndexOf(" ");
  const base = ultimoEspaco > maximo * 0.55 ? corte.slice(0, ultimoEspaco) : corte;
  return `${base.trimEnd()}…`;
}

function limparMarkdown(md: string): string {
  return md
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s*/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extrairPrimeiroParagrafo(bodyMd: string | null): string {
  if (!bodyMd) return "";
  const blocos = bodyMd
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(
      (b) =>
        b.length > 0 &&
        !b.startsWith("#") &&
        !/^>\s*\*?\*?Fonte:/i.test(b),
    );
  const primeiro = blocos[0] ? limparMarkdown(blocos[0]) : "";
  return primeiro.length >= 40 ? truncarEmPalavra(primeiro, 280) : "";
}

/**
 * Monta a legenda para o feed do Instagram com título, breve resumo editorial,
 * atribuição de fonte, chamada para `/bio` e hashtags segmentadas.
 */
export function montarLegendaInstagram(
  artigo: ArtigoInstagram,
  siteUrl: string,
): string {
  const titulo = (artigo.title ?? artigo.sourceTitle).trim();
  const dek = artigo.dek?.trim() ?? "";
  const trechoCorpo = extrairPrimeiroParagrafo(artigo.bodyMd);
  const dominio = siteUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "");

  const partes: string[] = [titulo];

  if (dek) {
    partes.push(dek);
  }

  if (
    trechoCorpo &&
    (!dek || !trechoCorpo.toLowerCase().startsWith(dek.slice(0, 32).toLowerCase()))
  ) {
    partes.push(trechoCorpo);
  }

  partes.push(
    `Fonte original: ${artigo.sourceName}`,
    `Leia a matéria completa no link da bio (${dominio}/bio) ou acesse ${dominio}.`,
    HASHTAGS_POR_CATEGORIA[artigo.categorySlug] ?? HASHTAGS_POR_CATEGORIA.mundo,
  );

  const legenda = partes.join("\n\n");
  return legenda.length <= MAX_CARACTERES_LEGENDA
    ? legenda
    : truncarEmPalavra(legenda, MAX_CARACTERES_LEGENDA);
}

/**
 * Constrói a URL dinâmica no Cloudinary que gera um card editorial `1080×1350`
 * (proporção 4:5) em JPEG baseline (`fl_progressive:none`) exigido pela Meta.
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
  const labelCategoria = categoria.label.toUpperCase();

  const tituloBruto = (artigo.title ?? artigo.sourceTitle).trim();
  const manchete = truncarEmPalavra(tituloBruto, MAX_CARACTERES_MANCHETE_CARD);
  const tamanhoFonte =
    manchete.length <= 58 ? 52 : manchete.length <= 88 ? 46 : 42;

  const urlFotoBase = artigo.imageUrl?.trim() || fallbackBgUrl;
  const cropBase = artigo.imageUrl?.trim()
    ? "w_1080,h_1350,c_fill,g_auto"
    : "w_1080,h_1350,c_fill";

  const camadaOverlay = `l_fetch:${toBase64Url(overlayUrl)}/fl_layer_apply,w_1080,h_1350,g_center`;
  const camadaSelo = `bo_14px_solid_rgb:${cor},b_rgb:${cor},r_28,co_white,l_text:Montserrat@google_24_700_letter_spacing_2:${escaparTextoCloudinary(labelCategoria)}/fl_layer_apply,g_north_east,x_72,y_62`;
  const camadaManchete = `w_936,c_fit,co_white,l_text:Montserrat@google_${tamanhoFonte}_700_line_spacing_-4:${escaparTextoCloudinary(manchete)}/fl_layer_apply,g_south_west,x_72,y_182`;
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
