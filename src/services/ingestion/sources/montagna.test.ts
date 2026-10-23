import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analisarRss } from "../rss";
import { imagemOriginalSubstack, normalizarMontagna } from "./montagna";

const CTX = { userAgent: "teste", agora: 1_792_800_000 };

/** Estrutura real do `content:encoded` do Substack (23/10/2026), encurtada. */
const CORPO = `
<div class="captioned-image-container"><figure><a class="image-link"><div class="image2-inset"><img src="x.png"/></div></a><figcaption>Photo: Edward Pentin</figcaption></figure></div>
<p>VATICAN CITY, 23 October 2026 — The Vatican will bar pilgrims from entering St. Peter's Basilica.</p>
<p>According to the organizers, the decision came on Thursday.</p>
<div class="subscription-widget-wrap-editor"><div class="subscription-widget show-subscribe"><div class="preamble"><p class="cta-caption">Diane Montagna's Substack is a reader-supported publication. To receive new posts and support my work, consider becoming a free or paid subscriber.</p></div><form><div class="fake-input-wrapper"><div class="fake-input"></div><div class="fake-button"></div></div></form></div></div>
<p>The restriction extends to the customary gathering at the tomb of St. Peter.</p>
<hr/>
<p>My Substack is sustained entirely by you, its readers. I'm deeply grateful to those who choose to become paid subscribers.</p>
<p class="button-wrapper"><a class="button primary"><span>SUPPORT INDEPENDENT CATHOLIC JOURNALISM</span></a></p>
`;

function feed(itens: string): string {
  return `<?xml version="1.0"?><rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>t</title>${itens}</channel></rss>`;
}

const ITEM_TEXTO = `<item><title>Vatican Bars TLM Pilgrimage</title>
<link>https://dianemontagna.substack.com/p/vatican-bars-tlm-pilgrimage</link>
<pubDate>Fri, 23 Oct 2026 14:00:00 GMT</pubDate>
<enclosure url="https://substackcdn.com/image/fetch/$s_!9HcJ!,f_auto,q_auto:good/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fabc_1452x968.png" type="image/jpeg" length="0"/>
<content:encoded><![CDATA[${CORPO}]]></content:encoded></item>`;

const ITEM_AUDIO = `<item><title>Interview</title>
<link>https://dianemontagna.substack.com/p/interview</link>
<enclosure url="https://api.substack.com/feed/podcast/1.mp3" type="audio/mpeg" length="0"/>
<description>An interview.</description></item>`;

describe("fonte Diane Montagna", () => {
  const [texto, audio] = analisarRss(feed(ITEM_TEXTO + ITEM_AUDIO)).itens.map((i) =>
    normalizarMontagna(i, CTX),
  );

  it("mantém todos os parágrafos da notícia, inclusive os depois do widget", () => {
    assert.ok(texto?.excerpt?.includes("will bar pilgrims"));
    assert.ok(texto?.excerpt?.includes("came on Thursday"));
    assert.ok(texto?.excerpt?.includes("tomb of St. Peter"));
  });

  it("remove widget de assinatura, apelo de doação, botão e legenda", () => {
    const corpo = texto?.excerpt ?? "";
    for (const lixo of [
      "reader-supported",
      "sustained entirely",
      "SUPPORT INDEPENDENT",
      "paid subscriber",
      "Photo: Edward Pentin",
    ]) {
      assert.ok(!corpo.includes(lixo), `sobrou "${lixo}" no texto`);
    }
  });

  it("guarda a foto original do S3, não a URL do proxy do Substack", () => {
    assert.equal(
      texto?.imagemUrl,
      "https://substack-post-media.s3.amazonaws.com/public/images/abc_1452x968.png",
    );
  });

  it("não usa o MP3 de um episódio como imagem", () => {
    assert.equal(audio?.imagemUrl, undefined);
  });

  it("marca a fonte e o nome de exibição", () => {
    assert.equal(texto?.fonte, "montagna");
    assert.equal(texto?.nomeFonte, "Diane Montagna");
  });

  it("devolve URL fora do formato do proxy sem mexer", () => {
    assert.equal(imagemOriginalSubstack("https://exemplo.com/a.png"), "https://exemplo.com/a.png");
  });
});
