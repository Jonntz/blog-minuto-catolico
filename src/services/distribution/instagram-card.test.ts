import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { esquemaEnv } from "@/lib/env";
import {
  escaparTextoCloudinary,
  higienizarTextoEditorial,
  montarLegendaInstagram,
  montarUrlCardInstagram,
  toBase64Url,
  truncarMancheteCard,
  validarTextosParaInstagram,
  type ArtigoInstagram,
} from "./instagram-card";

const ARTIGO_EXEMPLO: ArtigoInstagram = {
  id: "art-1",
  slug: "papa-leao-xiv-reforma-liturgica",
  title: "Papa Leão XIV convoca encontro sobre liturgia, arte sacra e 50% das dioceses",
  sourceTitle: "Pope Leo XIV calls meeting on liturgy and sacred art",
  dek: "O Pontífice reuniu bispos em Roma para tratar da beleza e da reverência nas celebrações paroquiais.",
  bodyMd:
    "O encontro reuniu representantes das dioceses em Roma.\n\nSegundo os organizadores, as novas orientações devem chegar às paróquias ainda neste semestre para fortalecer a formação do clero.\n\n> **Fonte:** EWTN News",
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

  it("gera URL Cloudinary 1080x1350 JPEG baseline com selo protegido contra corte", () => {
    const url = montarUrlCardInstagram({
      cloudName: "meu-cloud",
      siteUrl: "https://minutocatolico.com.br",
      artigo: { ...ARTIGO_EXEMPLO, categorySlug: "mundo" },
    });

    assert.ok(
      url.startsWith("https://res.cloudinary.com/meu-cloud/image/fetch/w_1080,h_1350,c_fill,g_auto/"),
    );
    assert.ok(
      url.includes(
        `l_fetch:${toBase64Url("https://minutocatolico.com.br/social/overlay-instagram.png")}/`,
      ),
    );
    // Usa espaços não-quebráveis (\u00A0\u00A0 = %C2%A0%C2%A0) e r_10 para
    // impedir corte na letra "I" de "IGREJA NO MUNDO".
    assert.ok(url.includes("bo_10px_solid_rgb:3f3f46,b_rgb:3f3f46,r_10"));
    assert.ok(url.includes("%C2%A0%C2%A0IGREJA%20NO%20MUNDO%C2%A0%C2%A0"));
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

  it("higieniza Markdown, entidades HTML, espaços antes de vírgula e inicial minúscula", () => {
    const limpo = higienizarTextoEditorial(
      "o documentário *The Dating Project* &amp; os jovens ,na visão da **Igreja** .",
    );
    assert.equal(
      limpo,
      "O documentário The Dating Project & os jovens, na visão da Igreja.",
    );
  });

  it("corta manchetes longas sem deixar preposições ou artigos soltos no fim", () => {
    const cortada = truncarMancheteCard(
      "Conferência Episcopal divulga novo documento pastoral sobre a evangelização das famílias na América",
      72,
    );
    assert.ok(cortada.length <= 72);
    assert.ok(!/\b(?:a|o|de|da|do|em|sobre|para|com|e)…$/i.test(cortada), cortada);
  });

  it("pula parágrafo redundante ao dek e fecha em frase completa na legenda", () => {
    const redundante: ArtigoInstagram = {
      ...ARTIGO_EXEMPLO,
      dek: "“The Dating Project”, da Family Theater Productions, acompanha quatro grupos de solteiros nos EUA.",
      bodyMd:
        "O documentário *The Dating Project*, da Family Theater Productions, acompanha quatro grupos de solteiros nos Estados Unidos.\n\nPara os produtores, voltar ao encontro presencial ajuda os jovens a construir relações verdadeiras e duradouras.\n\n> **Fonte:** EWTN News",
    };

    const legenda = montarLegendaInstagram(
      redundante,
      "https://minutocatolico.com.br",
    );

    assert.ok(!legenda.includes("*The Dating Project*"));
    assert.ok(legenda.includes("Para os produtores, voltar ao encontro presencial"));
    assert.ok(!legenda.includes("Estados Unidos."));
    assert.ok(legenda.includes("Fonte original: EWTN News"));
    assert.ok(legenda.includes("minutocatolico.com.br/bio"));
    assert.ok(legenda.length <= 2_200);
  });

  it("reprova texto em inglês ou com vazamento de HTML antes de publicar no Instagram", () => {
    const emIngles = validarTextosParaInstagram(
      {
        ...ARTIGO_EXEMPLO,
        title: "Pope meets with bishops from the United States in Rome",
        dek: "The meeting discussed pastoral priorities for their dioceses and parishes.",
      },
      "https://minutocatolico.com.br",
    );
    assert.equal(emIngles.ok, false);

    const valido = validarTextosParaInstagram(
      ARTIGO_EXEMPLO,
      "https://minutocatolico.com.br",
    );
    assert.equal(valido.ok, true);
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
