import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { esquemaEnv } from "@/lib/env";
import {
  escaparTextoCloudinary,
  montarLegendaInstagram,
  montarUrlCardInstagram,
  toBase64Url,
  type ArtigoInstagram,
} from "./instagram-card";

const ARTIGO_EXEMPLO: ArtigoInstagram = {
  id: "art-1",
  slug: "papa-leao-xiv-reforma-liturgica",
  title: "Papa Leão XIV convoca encontro sobre liturgia, arte sacra e 50% das dioceses",
  sourceTitle: "Pope Leo XIV calls meeting on liturgy and sacred art",
  dek: "O Pontífice reuniu bispos em Roma para tratar da beleza e da reverência nas celebrações paroquiais.",
  bodyMd:
    "Durante a audiência desta manhã no Vaticano, o Santo Padre destacou que a liturgia exige fidelidade aos livros litúrgicos e cuidado pastoral.\n\n> **Fonte:** EWTN News",
  categorySlug: "vaticano",
  sourceName: "EWTN News",
  imageUrl:
    "https://res.cloudinary.com/ewtn/image/upload/v1785169101/ewtn-news/en/IMG_8844_qalyzn.jpg",
  imageCaption: "Basílica de São Pedro",
};

describe("instagram-card — geração de card Cloudinary e legenda", () => {
  it("aplica double-encoding para vírgulas, barras e porcentagem no Cloudinary", () => {
    const escapado = escaparTextoCloudinary("Ação: 50%, fé/razão!");
    assert.ok(escapado.includes("50%2525%252C"), "deveria escapar % e vírgula");
    assert.ok(escapado.includes("f%C3%A9%252Fraz%C3%A3o%21"), "deveria escapar barra e acento");
  });

  it("gera URL Cloudinary 1080x1350 JPEG baseline com overlay e selo da categoria", () => {
    const url = montarUrlCardInstagram({
      cloudName: "meu-cloud",
      siteUrl: "https://minutocatolico.com.br",
      artigo: ARTIGO_EXEMPLO,
    });

    assert.ok(
      url.startsWith("https://res.cloudinary.com/meu-cloud/image/fetch/w_1080,h_1350,c_fill,g_auto/"),
    );
    assert.ok(
      url.includes(
        `l_fetch:${toBase64Url("https://minutocatolico.com.br/social/overlay-instagram.png")}/`,
      ),
    );
    assert.ok(url.includes("b_rgb:1d4ed8"));
    assert.ok(url.includes("/f_jpg,fl_progressive:none,q_88/"));
    assert.ok(url.endsWith(ARTIGO_EXEMPLO.imageUrl!));
  });

  it("usa bg-editorial.jpg como fallback quando o artigo não possui imageUrl", () => {
    const url = montarUrlCardInstagram({
      cloudName: "meu-cloud",
      siteUrl: "https://minutocatolico.com.br",
      artigo: { ...ARTIGO_EXEMPLO, imageUrl: null, categorySlug: "liturgia" },
    });

    assert.ok(url.includes("b_rgb:15803d"));
    assert.ok(url.endsWith("https://minutocatolico.com.br/social/bg-editorial.jpg"));
  });

  it("monta legenda com resumo, atribuição da fonte, CTA /bio e limite de 2.200 caracteres", () => {
    const legenda = montarLegendaInstagram(
      ARTIGO_EXEMPLO,
      "https://minutocatolico.com.br",
    );

    assert.ok(legenda.includes(ARTIGO_EXEMPLO.title!));
    assert.ok(legenda.includes(ARTIGO_EXEMPLO.dek!));
    assert.ok(legenda.includes("Durante a audiência desta manhã no Vaticano"));
    assert.ok(legenda.includes("Fonte original: EWTN News"));
    assert.ok(legenda.includes("minutocatolico.com.br/bio"));
    assert.ok(legenda.includes("#Vaticano"));
    assert.ok(legenda.length <= 2_200);
  });

  it("valida variáveis de ambiente do Instagram com padrões seguros quando omitidas", () => {
    const base = {
      SITE_URL: "https://minutocatolico.com.br/",
      CRON_SECRET: "segredo-muito-forte-com-mais-de-32-caracteres",
    };
    const padrao = esquemaEnv.parse(base);
    assert.equal(padrao.SITE_URL, "https://minutocatolico.com.br");
    assert.equal(padrao.INSTAGRAM_MAX_POSTS_DIA, 5);
    assert.equal(padrao.INSTAGRAM_INTERVALO_MIN_MINUTOS, 180);
    assert.equal(padrao.INSTAGRAM_ACCESS_TOKEN, undefined);

    const custom = esquemaEnv.parse({
      ...base,
      INSTAGRAM_MAX_POSTS_DIA: "8",
      INSTAGRAM_INTERVALO_MIN_MINUTOS: "60",
      CLOUDINARY_CLOUD_NAME: "minuto-cloud",
    });
    assert.equal(custom.INSTAGRAM_MAX_POSTS_DIA, 8);
    assert.equal(custom.INSTAGRAM_INTERVALO_MIN_MINUTOS, 60);
    assert.equal(custom.CLOUDINARY_CLOUD_NAME, "minuto-cloud");
  });
});
