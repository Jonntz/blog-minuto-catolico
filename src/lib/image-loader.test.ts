import assert from "node:assert/strict";
import { describe, it } from "node:test";
import carregadorDeImagem, { otimizarUrlImagemExterna } from "./image-loader";

describe("carregadorDeImagem (loader customizado next/image)", () => {
  it("injeta f_auto e qualidade numérica (sem q_auto:eco) em res.cloudinary.com e cdn1.ewtn.com", () => {
    const legado =
      "https://res.cloudinary.com/ewtn/image/upload/v1785169101/ewtn-news/en/IMG_8844_qalyzn.jpg";
    assert.equal(
      carregadorDeImagem({ src: legado, width: 750, quality: 75 }),
      "https://res.cloudinary.com/ewtn/image/upload/f_auto,q_75,w_750,c_limit/v1785169101/ewtn-news/en/IMG_8844_qalyzn.jpg",
    );

    const atual =
      "https://cdn1.ewtn.com/image/upload/ewtn-news/en/aci-africa_nick.webp";
    assert.equal(
      carregadorDeImagem({ src: atual, width: 640 }),
      "https://cdn1.ewtn.com/image/upload/f_auto,q_75,w_640,c_limit/ewtn-news/en/aci-africa_nick.webp",
    );
  });

  it("gera JPEG 1200px para og:image mesmo quando a origem é .webp ou .png", () => {
    const webpEwtn =
      "https://cdn1.ewtn.com/image/upload/ewtn-news/en/aci-africa_nick.webp";
    assert.equal(
      otimizarUrlImagemExterna({
        src: webpEwtn,
        width: 1200,
        quality: 80,
        formato: "f_jpg",
      }),
      "https://cdn1.ewtn.com/image/upload/f_jpg,q_80,w_1200,c_limit/ewtn-news/en/aci-africa_nick.webp",
    );

    const pngSubstack =
      "https://substack-post-media.s3.amazonaws.com/public/images/foto.png";
    assert.equal(
      otimizarUrlImagemExterna({
        src: pngSubstack,
        width: 1200,
        quality: 80,
        formato: "f_jpg",
      }),
      `https://substackcdn.com/image/fetch/w_1200,c_limit,f_jpg,q_auto:good/${encodeURIComponent(pngSubstack)}`,
    );
  });

  it("usa o proxy de otimização do Substack com q_auto:good para Diane Montagna", () => {
    const s3 =
      "https://substack-post-media.s3.amazonaws.com/public/images/abc-123_1600x900.jpeg";
    const otimizada = carregadorDeImagem({
      src: s3,
      width: 640,
    });
    assert.equal(
      otimizada,
      `https://substackcdn.com/image/fetch/w_640,c_limit,f_auto,q_auto:good/${encodeURIComponent(s3)}`,
    );
  });

  it("mantém outras URLs intactas sem depender de /_next/image", () => {
    const outra = "https://www.ewtnnews.com/images/logo.png";
    assert.equal(carregadorDeImagem({ src: outra, width: 384 }), outra);
  });
});
