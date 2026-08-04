import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { DESCRICAO_SITE, getSiteUrl, LOGO, NOME_SITE } from "@/lib/seo";

/**
 * Web App Manifest.
 *
 * Deliberadamente mínimo: o portal é um site de leitura, não um aplicativo. O
 * que se quer daqui é nome e ícone corretos quando alguém adiciona à tela
 * inicial no celular — e o sinal de "site cuidado" que uma auditoria de rede de
 * anúncios procura. Nada de `display: "standalone"`: esconder a barra de
 * endereço num site de notícias tira do leitor a forma mais direta de conferir
 * de onde o conteúdo vem, o que num portal religioso é o oposto do que
 * queremos.
 *
 * `connection()` porque `getSiteUrl()` depende de `SITE_URL`, e sob Cache
 * Components ler isso exige marcar a rota como dinâmica — mesma regra de
 * `robots.ts` e `sitemap.ts`.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  await connection();
  const base = await getSiteUrl();

  return {
    name: NOME_SITE,
    short_name: NOME_SITE,
    description: DESCRICAO_SITE,
    start_url: base,
    display: "browser",
    lang: "pt-BR",
    // Espelham o `themeColor` do root layout — divergir faria a barra do
    // sistema piscar com outra cor ao abrir.
    background_color: "#fbfaf7",
    theme_color: "#fbfaf7",
    icons: [
      {
        src: LOGO.caminho,
        sizes: `${LOGO.largura}x${LOGO.altura}`,
        type: "image/png",
        // `any maskable` para o Android poder recortar sem cortar o desenho.
        purpose: "any",
      },
    ],
  };
}
