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
 *  - **EWTN (Cloudinary):** injeta `f_auto,q_auto:eco,w_<w>,c_limit` após
 *    `/image/upload/` (entrega AVIF no Chrome/Lighthouse e WebP no Safari com
 *    ~40% menos bytes que `q_75` fixo).
 *  - **Diane Montagna (Substack S3):** usa o proxy CDN oficial `substackcdn.com/image/fetch/...`.
 *
 * Além de eliminar o risco de quebra por cota (erro 9422), o navegador baixa a
 * imagem direto da CDN de origem em HTTP/3 (com `<link rel="preconnect">` no
 * `<head>`), sem passar pelo nosso Worker como intermediário.
 */
export default function carregadorDeImagem({
  src,
  width,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  // 1. Cloudinary (EWTN): transforma e converte para AVIF/WebP na própria CDN.
  if (
    src.includes("res.cloudinary.com/") &&
    src.includes("/image/upload/") &&
    !src.includes("/image/upload/f_auto")
  ) {
    return src.replace(
      "/image/upload/",
      `/image/upload/f_auto,q_auto:eco,w_${width},c_limit/`,
    );
  }

  // 2. Substack S3 (Diane Montagna): usa o otimizador oficial do Substack.
  if (src.startsWith("https://substack-post-media.s3.amazonaws.com/")) {
    return `https://substackcdn.com/image/fetch/w_${width},c_limit,f_auto,q_auto:eco/${encodeURIComponent(src)}`;
  }

  // 3. Qualquer outra URL (local ou externa): serve diretamente.
  return src;
}
