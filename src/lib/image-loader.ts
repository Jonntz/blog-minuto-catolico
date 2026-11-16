/**
 * Loader customizado do `next/image` (`images.loaderFile` em `next.config.ts`).
 *
 * ## Por que não usar `/_next/image` + binding `IMAGES` da Cloudflare
 *
 * No `@opennextjs/cloudflare`, a rota `/_next/image` chama `env.IMAGES.input()`
 * a cada requisição cuja origem não envie `Cache-Control: immutable` (caso do
 * Cloudinary e do S3). Isso consome as 5.000 transformações mensais do plano
 * Free em poucas centenas de visitas e, ao atingir o teto, a Cloudflare passa
 * a devolver o erro 9422 (HTTP 500) em TODAS as imagens do portal.
 *
 * As duas fontes com foto do portal já possuem CDNs próprias de transformação
 * gratuita e ilimitada:
 *  - **EWTN (Cloudinary):** injeta `f_auto,q_<q>,w_<w>,c_limit` após `/image/upload/`.
 *  - **Diane Montagna (Substack S3):** usa o proxy CDN oficial `substackcdn.com/image/fetch/...`.
 *
 * Além de eliminar o risco de quebra por cota (erro 9422), o navegador baixa a
 * imagem direto da CDN de origem em HTTP/3 sem passar pelo nosso Worker como
 * intermediário, reduzindo o TTFB da imagem LCP.
 */
export default function carregadorDeImagem({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  const q = quality ?? 75;

  // 1. Cloudinary (EWTN): transforma e converte para WebP/AVIF na própria CDN.
  if (
    src.includes("res.cloudinary.com/") &&
    src.includes("/image/upload/") &&
    !src.includes("/image/upload/f_") &&
    !src.includes("/image/upload/w_")
  ) {
    return src.replace(
      "/image/upload/",
      `/image/upload/f_auto,q_${q},w_${width},c_limit/`,
    );
  }

  // 2. Substack S3 (Diane Montagna): usa o otimizador oficial do Substack.
  if (src.startsWith("https://substack-post-media.s3.amazonaws.com/")) {
    return `https://substackcdn.com/image/fetch/w_${width},c_limit,f_auto,q_auto:good/${encodeURIComponent(src)}`;
  }

  // 3. Qualquer outra URL (local ou externa): serve diretamente.
  return src;
}
