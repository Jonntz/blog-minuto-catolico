/**
 * Loader customizado do `next/image` (`images.loaderFile` em `next.config.ts`)
 * e normalizador de URLs sociais (`og:image`).
 *
 * ## Por que não usar `q_auto:eco` nas URLs da EWTN
 *
 * Em `res.cloudinary.com/ewtn` e `cdn1.ewtn.com` (CNAME da mesma conta), o
 * parâmetro `q_auto:eco` retorna HTTP 403 (`Your entitlement packages don't
 * support: Apply advanced quality control to images`), quebrando todas as
 * imagens. Qualidade numérica (`q_75`, `q_80`) + `f_auto` / `f_jpg` devolve
 * HTTP 200 com cache na borda.
 */

export interface OpcoesImagemExterna {
  src: string;
  width: number;
  quality?: number;
  formato?: "f_auto" | "f_jpg";
}

export function otimizarUrlImagemExterna({
  src,
  width,
  quality = 75,
  formato = "f_auto",
}: OpcoesImagemExterna): string {
  // 1. EWTN (`res.cloudinary.com` legado e `cdn1.ewtn.com` atual).
  if (
    (src.includes("res.cloudinary.com/") || src.includes("cdn1.ewtn.com/")) &&
    src.includes("/image/upload/") &&
    !src.includes("/image/upload/f_") &&
    !src.includes("/image/upload/w_")
  ) {
    return src.replace(
      "/image/upload/",
      `/image/upload/${formato},q_${quality},w_${width},c_limit/`,
    );
  }

  // 2. Substack S3 (Diane Montagna): usa o otimizador oficial do Substack.
  if (src.startsWith("https://substack-post-media.s3.amazonaws.com/")) {
    return `https://substackcdn.com/image/fetch/w_${width},c_limit,${formato},q_auto:good/${encodeURIComponent(src)}`;
  }

  // 3. Qualquer outra URL (local ou externa): serve diretamente.
  return src;
}

export default function carregadorDeImagem({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  return otimizarUrlImagemExterna({
    src,
    width,
    quality: quality ?? 75,
    formato: "f_auto",
  });
}
