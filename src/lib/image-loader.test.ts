import assert from "node:assert/strict";
import { describe, it } from "node:test";
import carregadorDeImagem from "./image-loader";

describe("carregadorDeImagem (loader customizado next/image)", () => {
  it("injeta parâmetros de largura, q_auto:eco e f_auto em URLs do Cloudinary", () => {
    const original =
      "https://res.cloudinary.com/ewtn/image/upload/v1785169101/ewtn-news/en/IMG_8844_qalyzn.jpg";
    const otimizada = carregadorDeImagem({
      src: original,
      width: 750,
      quality: 75,
    });
    assert.equal(
      otimizada,
      "https://res.cloudinary.com/ewtn/image/upload/f_auto,q_auto:eco,w_750,c_limit/v1785169101/ewtn-news/en/IMG_8844_qalyzn.jpg",
    );
  });

  it("usa o proxy de otimização do Substack para imagens do S3 da Diane Montagna", () => {
    const s3 =
      "https://substack-post-media.s3.amazonaws.com/public/images/abc-123_1600x900.jpeg";
    const otimizada = carregadorDeImagem({
      src: s3,
      width: 640,
    });
    assert.equal(
      otimizada,
      `https://substackcdn.com/image/fetch/w_640,c_limit,f_auto,q_auto:eco/${encodeURIComponent(s3)}`,
    );
  });

  it("mantém outras URLs intactas sem depender de /_next/image", () => {
    const outra = "https://www.ewtnnews.com/images/logo.png";
    assert.equal(carregadorDeImagem({ src: outra, width: 384 }), outra);
  });
});
